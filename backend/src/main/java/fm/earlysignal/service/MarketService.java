package fm.earlysignal.service;

import fm.earlysignal.api.Dtos.*;
import fm.earlysignal.api.GameException;
import fm.earlysignal.config.GameProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Read side of the game: market data, portfolios, leaderboard, users. */
@Service
public class MarketService {
    private final JdbcTemplate jdbc;
    private final GameProperties props;

    public MarketService(JdbcTemplate jdbc, GameProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    public LocalDate gameDate() {
        return jdbc.queryForObject("SELECT game_date FROM game_state WHERE id = 1", LocalDate.class);
    }

    public UserDto createOrGetUser(CreateUserRequest req) {
        String username = req.username() == null ? "" : req.username().trim();
        if (!username.matches("[A-Za-z0-9_]{3,20}")) {
            throw GameException.badRequest("Username must be 3-20 letters, numbers, or underscores");
        }
        boolean isBot = Boolean.TRUE.equals(req.isBot());
        jdbc.update("INSERT INTO users (username, cash, is_bot) VALUES (?, ?, ?) ON CONFLICT (username) DO NOTHING",
                username, props.startingCash(), isBot);
        return jdbc.queryForObject("SELECT id, username, cash, is_bot FROM users WHERE username = ?",
                (rs, i) -> new UserDto(rs.getLong("id"), rs.getString("username"),
                        rs.getBigDecimal("cash"), rs.getBoolean("is_bot")),
                username);
    }

    public List<ArtistDto> artists() {
        return jdbc.query("SELECT id, ticker, name, tier, price, prev_price, listeners FROM artists ORDER BY ticker",
                (rs, i) -> {
                    BigDecimal price = rs.getBigDecimal("price");
                    BigDecimal prev = rs.getBigDecimal("prev_price");
                    double change = prev.signum() == 0 ? 0
                            : price.subtract(prev).divide(prev, 6, RoundingMode.HALF_UP).doubleValue() * 100;
                    return new ArtistDto(rs.getLong("id"), rs.getString("ticker"), rs.getString("name"),
                            rs.getString("tier"), price, Math.round(change * 100) / 100.0, rs.getLong("listeners"));
                });
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
        return jdbc.query("SELECT game_date, price, listeners FROM price_history WHERE artist_id = ? ORDER BY game_date",
                (rs, i) -> new PricePoint(rs.getObject("game_date", LocalDate.class),
                        rs.getBigDecimal("price"), rs.getLong("listeners")),
                artistId);
    }

    /** Only forecasts after the current game date, so stale rows vanish once Advance Day passes them. */
    public List<ForecastPoint> forecast(long artistId) {
        resolveArtistId(artistId, null);
        return jdbc.query("""
                SELECT forecast_date, mean, lower, upper FROM forecasts
                WHERE artist_id = ? AND forecast_date > (SELECT game_date FROM game_state WHERE id = 1)
                ORDER BY forecast_date""",
                (rs, i) -> new ForecastPoint(rs.getObject("forecast_date", LocalDate.class),
                        rs.getBigDecimal("mean"), rs.getBigDecimal("lower"), rs.getBigDecimal("upper")),
                artistId);
    }

    public List<EventDto> events(int limit) {
        return jdbc.query("""
                SELECT e.id, e.artist_id, a.ticker, e.type, e.message, e.game_date
                FROM events e JOIN artists a ON a.id = e.artist_id
                ORDER BY e.game_date DESC, e.id DESC LIMIT ?""",
                (rs, i) -> new EventDto(rs.getLong("id"), rs.getLong("artist_id"), rs.getString("ticker"),
                        rs.getString("type"), rs.getString("message"), rs.getObject("game_date", LocalDate.class)),
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
        return jdbc.query("""
                SELECT t.id, t.artist_id, a.ticker, t.side, t.shares, t.price, t.fee, t.game_date, t.created_at
                FROM transactions t JOIN artists a ON a.id = t.artist_id
                WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 200""",
                (rs, i) -> new TransactionDto(rs.getLong("id"), rs.getLong("artist_id"), rs.getString("ticker"),
                        rs.getString("side"), rs.getInt("shares"), rs.getBigDecimal("price"), rs.getBigDecimal("fee"),
                        rs.getObject("game_date", LocalDate.class), rs.getObject("created_at", OffsetDateTime.class)),
                userId);
    }

    public List<LeaderboardEntry> leaderboard(int limit) {
        return jdbc.query("""
                SELECT u.id, u.username, u.is_bot,
                       u.cash + COALESCE(SUM(h.shares * a.price), 0) AS total
                FROM users u
                LEFT JOIN holdings h ON h.user_id = u.id
                LEFT JOIN artists a ON a.id = h.artist_id
                GROUP BY u.id, u.username, u.is_bot, u.cash
                ORDER BY total DESC LIMIT ?""",
                (rs, i) -> new LeaderboardEntry(i + 1, rs.getLong("id"), rs.getString("username"),
                        rs.getBigDecimal("total").setScale(2, RoundingMode.HALF_UP), rs.getBoolean("is_bot")),
                Math.min(Math.max(limit, 1), 500));
    }

    private UserDto user(long userId) {
        try {
            return jdbc.queryForObject("SELECT id, username, cash, is_bot FROM users WHERE id = ?",
                    (rs, i) -> new UserDto(rs.getLong("id"), rs.getString("username"),
                            rs.getBigDecimal("cash"), rs.getBoolean("is_bot")),
                    userId);
        } catch (EmptyResultDataAccessException e) {
            throw GameException.notFound("Unknown user: " + userId);
        }
    }
}
