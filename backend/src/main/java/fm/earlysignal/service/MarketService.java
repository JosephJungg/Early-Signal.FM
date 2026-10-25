package fm.earlysignal.service;

import fm.earlysignal.api.Dtos.*;
import fm.earlysignal.api.GameException;
import fm.earlysignal.config.GameProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

/** Read side of the game: market data, portfolios, leaderboard, users. */
@Service
public class MarketService {
    private static final Set<String> KINDS = Set.of("human", "bot", "ai");
    private static final RowMapper<UserDto> USER = (rs, i) -> new UserDto(rs.getLong("id"), rs.getString("username"),
            rs.getBigDecimal("cash"), rs.getBoolean("is_bot"), rs.getString("kind"));

    private final JdbcTemplate jdbc;
    private final GameProperties props;

    public MarketService(JdbcTemplate jdbc, GameProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    public LocalDate gameDate() {
        return jdbc.queryForObject("SELECT game_date FROM game_state WHERE id = 1", LocalDate.class);
    }

    public GameDto game() {
        LocalDate date = gameDate();
        return new GameDto(date, dayOf(date));
    }

    /** Day 0 is the first day of seeded price history, matching the terminal's DAY counter. */
    public long dayOf(LocalDate date) {
        return dayOf(startDate(), date);
    }

    private LocalDate startDate() {
        return jdbc.queryForObject("SELECT MIN(game_date) FROM price_history", LocalDate.class);
    }

    private static long dayOf(LocalDate start, LocalDate date) {
        return start == null ? 0 : ChronoUnit.DAYS.between(start, date);
    }

    public UserDto createOrGetUser(CreateUserRequest req) {
        String username = req.username() == null ? "" : req.username().trim();
        if (!username.matches("[A-Za-z0-9_-]{3,20}")) {
            throw GameException.badRequest("Username must be 3-20 letters, numbers, underscores, or hyphens");
        }
        String kind = req.kind() == null || req.kind().isBlank()
                ? (Boolean.TRUE.equals(req.isBot()) ? "bot" : "human")
                : req.kind().trim().toLowerCase();
        if (!KINDS.contains(kind)) {
            throw GameException.badRequest("Kind must be human, bot, or ai");
        }
        jdbc.update("""
                INSERT INTO users (username, cash, is_bot, kind) VALUES (?, ?, ?, ?)
                ON CONFLICT (username) DO NOTHING""",
                username, props.startingCash(), !kind.equals("human"), kind);
        return jdbc.queryForObject("SELECT id, username, cash, is_bot, kind FROM users WHERE username = ?", USER, username);
    }

    public List<ArtistDto> artists() {
        return jdbc.query("SELECT id, ticker, name, genre, tier, price, prev_price, listeners FROM artists ORDER BY ticker",
                (rs, i) -> new ArtistDto(rs.getLong("id"), rs.getString("ticker"), rs.getString("name"),
                        rs.getString("genre"), rs.getString("tier"), rs.getBigDecimal("price"),
                        pctChange(rs.getBigDecimal("price"), rs.getBigDecimal("prev_price")), rs.getLong("listeners")));
    }

    /** Everything the market table, ticker tape, and chart need, in three queries instead of one call per artist. */
    public MarketDto market() {
        LocalDate gameDate = gameDate();
        LocalDate start = startDate();

        Map<Long, List<PricePoint>> history = new HashMap<>();
        jdbc.query("SELECT artist_id, game_date, price, listeners FROM price_history ORDER BY artist_id, game_date",
                (RowCallbackHandler) rs -> {
                    LocalDate d = rs.getObject("game_date", LocalDate.class);
                    history.computeIfAbsent(rs.getLong("artist_id"), k -> new ArrayList<>())
                            .add(new PricePoint(d, dayOf(start, d), rs.getBigDecimal("price"), rs.getLong("listeners")));
                });

        Map<Long, List<ForecastPoint>> forecasts = new HashMap<>();
        jdbc.query("""
                SELECT artist_id, forecast_date, mean, lower, upper FROM forecasts
                WHERE forecast_date > ? ORDER BY artist_id, forecast_date""",
                (RowCallbackHandler) rs -> {
                    LocalDate d = rs.getObject("forecast_date", LocalDate.class);
                    forecasts.computeIfAbsent(rs.getLong("artist_id"), k -> new ArrayList<>())
                            .add(new ForecastPoint(d, dayOf(start, d), rs.getBigDecimal("mean"),
                                    rs.getBigDecimal("lower"), rs.getBigDecimal("upper")));
                },
                gameDate);

        List<MarketArtistDto> artists = jdbc.query("""
                SELECT id, ticker, name, genre, tier, price, prev_price, listeners FROM artists ORDER BY ticker""",
                (rs, i) -> {
                    long id = rs.getLong("id");
                    BigDecimal price = rs.getBigDecimal("price");
                    BigDecimal prev = rs.getBigDecimal("prev_price");
                    long listeners = rs.getLong("listeners");
                    List<PricePoint> h = history.getOrDefault(id, List.of());
                    long prevListeners = h.size() >= 2 ? h.get(h.size() - 2).listeners() : listeners;
                    double listenersChangePct = prevListeners == 0 ? 0
                            : Math.round((listeners - prevListeners) * 10000.0 / prevListeners) / 100.0;
                    return new MarketArtistDto(id, rs.getString("ticker"), rs.getString("name"), rs.getString("genre"),
                            rs.getString("tier"), price, price.subtract(prev), pctChange(price, prev),
                            listeners, listenersChangePct, h, forecasts.getOrDefault(id, List.of()));
                });
        return new MarketDto(gameDate, dayOf(start, gameDate), artists);
    }

    /** Accepts an id or a ticker so the command line can trade by symbol. */
    public long resolveArtistId(Long artistId, String ticker) {
        try {
            if (artistId != null) {
                return jdbc.queryForObject("SELECT id FROM artists WHERE id = ?", Long.class, artistId);
            }
            if (ticker != null && !ticker.isBlank()) {
                return jdbc.queryForObject("SELECT id FROM artists WHERE ticker = ?", Long.class,
                        ticker.trim().toUpperCase());
            }
        } catch (EmptyResultDataAccessException e) {
            throw GameException.notFound("Unknown artist: " + (artistId != null ? artistId : ticker));
        }
        throw GameException.badRequest("Provide artistId or ticker");
    }

    public List<PricePoint> history(long artistId) {
        resolveArtistId(artistId, null);
        LocalDate start = startDate();
        return jdbc.query("SELECT game_date, price, listeners FROM price_history WHERE artist_id = ? ORDER BY game_date",
                (rs, i) -> {
                    LocalDate d = rs.getObject("game_date", LocalDate.class);
                    return new PricePoint(d, dayOf(start, d), rs.getBigDecimal("price"), rs.getLong("listeners"));
                },
                artistId);
    }

    /** Only forecasts after the current game date, so stale rows vanish once Advance Day passes them. */
    public List<ForecastPoint> forecast(long artistId) {
        resolveArtistId(artistId, null);
        LocalDate start = startDate();
        return jdbc.query("""
                SELECT forecast_date, mean, lower, upper FROM forecasts
                WHERE artist_id = ? AND forecast_date > (SELECT game_date FROM game_state WHERE id = 1)
                ORDER BY forecast_date""",
                (rs, i) -> {
                    LocalDate d = rs.getObject("forecast_date", LocalDate.class);
                    return new ForecastPoint(d, dayOf(start, d), rs.getBigDecimal("mean"),
                            rs.getBigDecimal("lower"), rs.getBigDecimal("upper"));
                },
                artistId);
    }

    /**
     * Each player's first buy of this artist, earliest first. Same-day buys rank by trade order (transaction id).
     * Selling out keeps your spot, so shares can be 0.
     */
    public List<FanEntry> fans(long artistId, int limit) {
        resolveArtistId(artistId, null);
        LocalDate start = startDate();
        return jdbc.query("""
                SELECT f.user_id, u.username, u.kind, u.is_bot, f.game_date, f.price, COALESCE(h.shares, 0) AS shares
                FROM (SELECT DISTINCT ON (user_id) user_id, id, game_date, price FROM transactions
                      WHERE artist_id = ? AND side = 'BUY' ORDER BY user_id, id) f
                JOIN users u ON u.id = f.user_id
                LEFT JOIN holdings h ON h.user_id = f.user_id AND h.artist_id = ?
                ORDER BY f.game_date, f.id LIMIT ?""",
                (rs, i) -> {
                    LocalDate d = rs.getObject("game_date", LocalDate.class);
                    return new FanEntry(i + 1, rs.getLong("user_id"), rs.getString("username"), rs.getString("kind"),
                            rs.getBoolean("is_bot"), d, dayOf(start, d), rs.getBigDecimal("price"), rs.getInt("shares"));
                },
                artistId, artistId, Math.min(Math.max(limit, 1), 500));
    }

    public List<EventDto> events(int limit) {
        LocalDate start = startDate();
        return jdbc.query("""
                SELECT e.id, e.artist_id, a.ticker, e.type, e.message, e.impact_pct, e.game_date
                FROM events e JOIN artists a ON a.id = e.artist_id
                ORDER BY e.game_date DESC, e.id DESC LIMIT ?""",
                (rs, i) -> {
                    LocalDate d = rs.getObject("game_date", LocalDate.class);
                    return new EventDto(rs.getLong("id"), rs.getLong("artist_id"), rs.getString("ticker"),
                            rs.getString("type"), rs.getString("message"), rs.getDouble("impact_pct"), d, dayOf(start, d));
                },
                Math.min(Math.max(limit, 1), 200));
    }

    public PortfolioDto portfolio(long userId) {
        UserDto user = user(userId);
        List<HoldingDto> holdings = jdbc.query("""
                SELECT h.artist_id, a.ticker, h.shares, h.avg_cost, a.price
                FROM holdings h JOIN artists a ON a.id = h.artist_id
                WHERE h.user_id = ? ORDER BY a.ticker""",
                (rs, i) -> {
                    BigDecimal price = rs.getBigDecimal("price");
                    int shares = rs.getInt("shares");
                    return new HoldingDto(rs.getLong("artist_id"), rs.getString("ticker"), shares,
                            rs.getBigDecimal("avg_cost"), price, price.multiply(BigDecimal.valueOf(shares)));
                },
                userId);
        BigDecimal holdingsValue = holdings.stream().map(HoldingDto::value).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new PortfolioDto(user.id(), user.username(), user.cash(), holdingsValue,
                user.cash().add(holdingsValue), holdings);
    }

    public List<TransactionDto> transactions(long userId) {
        user(userId);
        LocalDate start = startDate();
        return jdbc.query("""
                SELECT t.id, t.artist_id, a.ticker, t.side, t.shares, t.price, t.fee, t.game_date, t.created_at
                FROM transactions t JOIN artists a ON a.id = t.artist_id
                WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT 200""",
                (rs, i) -> {
                    LocalDate d = rs.getObject("game_date", LocalDate.class);
                    return new TransactionDto(rs.getLong("id"), rs.getLong("artist_id"), rs.getString("ticker"),
                            rs.getString("side"), rs.getInt("shares"), rs.getBigDecimal("price"), rs.getBigDecimal("fee"),
                            d, dayOf(start, d), rs.getObject("created_at", OffsetDateTime.class));
                },
                userId);
    }

    /** prevValue uses yesterday's closing prices with today's cash and shares (close enough for the 1D arrow). */
    public List<LeaderboardEntry> leaderboard(int limit) {
        return jdbc.query("""
                SELECT u.id, u.username, u.kind, u.is_bot,
                       u.cash + COALESCE(SUM(h.shares * a.price), 0) AS total,
                       u.cash + COALESCE(SUM(h.shares * a.prev_price), 0) AS prev
                FROM users u
                LEFT JOIN holdings h ON h.user_id = u.id
                LEFT JOIN artists a ON a.id = h.artist_id
                GROUP BY u.id, u.username, u.kind, u.is_bot, u.cash
                ORDER BY total DESC, u.id LIMIT ?""",
                (rs, i) -> new LeaderboardEntry(i + 1, rs.getLong("id"), rs.getString("username"), rs.getString("kind"),
                        rs.getBoolean("is_bot"), rs.getBigDecimal("total").setScale(2, RoundingMode.HALF_UP),
                        rs.getBigDecimal("prev").setScale(2, RoundingMode.HALF_UP)),
                Math.min(Math.max(limit, 1), 500));
    }

    private UserDto user(long userId) {
        try {
            return jdbc.queryForObject("SELECT id, username, cash, is_bot, kind FROM users WHERE id = ?", USER, userId);
        } catch (EmptyResultDataAccessException e) {
            throw GameException.notFound("Unknown user: " + userId);
        }
    }

    private static double pctChange(BigDecimal price, BigDecimal prev) {
        if (prev.signum() == 0) {
            return 0;
        }
        double change = price.subtract(prev).divide(prev, 6, RoundingMode.HALF_UP).doubleValue() * 100;
        return Math.round(change * 100) / 100.0;
    }
}
