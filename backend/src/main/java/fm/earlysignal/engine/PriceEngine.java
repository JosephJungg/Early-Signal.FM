package fm.earlysignal.engine;

import fm.earlysignal.api.Dtos.AdvanceDayResult;
import fm.earlysignal.api.Dtos.EventDto;
import fm.earlysignal.config.GameProperties;
import fm.earlysignal.service.MarketService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moves the market forward one game day.
 *
 * listener growth g = drift + noise
 * daily log return  = 0.8 * g + volatility * N(0,1)
 * with chance EVENT_CHANCE an event fires: its impact is added to the return (and 0.6x to listener growth)
 * the return is clamped to +/- maxDailyMove, and new price = old price * exp(return)
 *
 * Event types and impact ranges match the frontend mock (frontend/src/mock/engine.js).
 * When Joseph's real listener data is ready, replace the simulated growth with a lookup.
 */
@Service
public class PriceEngine {
    private static final double LISTENER_WEIGHT = 0.8;
    private static final double EVENT_CHANCE = 0.07;
    private static final BigDecimal MIN_PRICE = new BigDecimal("0.50");

    /** headline is a format string taking the artist name. */
    public record EventKind(String type, double min, double max, String headline) {}

    public static final List<EventKind> EVENT_KINDS = List.of(
            new EventKind("VIRAL SPIKE", 0.15, 0.40, "%s track explodes on short-form video"),
            new EventKind("PLAYLIST ADD", 0.05, 0.12, "%s added to a major editorial playlist"),
            new EventKind("TOUR ANNOUNCED", 0.03, 0.08, "%s announces 30-city tour"),
            new EventKind("LABEL SIGNING", 0.06, 0.15, "%s signs with a major label"),
            new EventKind("COLLAB DROP", 0.04, 0.10, "Surprise collab featuring %s drops overnight"),
            new EventKind("ALBUM DELAY", -0.10, -0.04, "%s pushes album release to next year"),
            new EventKind("COLD STREAK", -0.25, -0.10, "%s streams cool off after a quiet month"));

    private final JdbcTemplate jdbc;
    private final GameProperties props;
    private final MarketService market;
    private final Random rng = new Random();

    public PriceEngine(JdbcTemplate jdbc, GameProperties props, MarketService market) {
        this.jdbc = jdbc;
        this.props = props;
        this.market = market;
    }

    @Transactional
    public AdvanceDayResult advanceDay() {
        LocalDate date = jdbc.queryForObject(
                "UPDATE game_state SET game_date = game_date + 1 WHERE id = 1 RETURNING game_date", LocalDate.class);
        long day = market.dayOf(date);

        // Lock all artists so trades wait while prices change.
        List<Map<String, Object>> artists = jdbc.queryForList("SELECT * FROM artists ORDER BY id FOR UPDATE");
        List<EventDto> events = new ArrayList<>();

        for (Map<String, Object> a : artists) {
            long id = ((Number) a.get("id")).longValue();
            String ticker = (String) a.get("ticker");
            String name = (String) a.get("name");
            double vol = ((Number) a.get("volatility")).doubleValue();
            double drift = ((Number) a.get("drift")).doubleValue();
            long listeners = ((Number) a.get("listeners")).longValue();
            BigDecimal price = (BigDecimal) a.get("price");

            double growth = drift + 0.5 * vol * rng.nextGaussian();
            double ret = LISTENER_WEIGHT * growth + vol * rng.nextGaussian();

            EventKind event = null;
            double impact = 0;
            if (rng.nextDouble() < EVENT_CHANCE) {
                event = EVENT_KINDS.get(rng.nextInt(EVENT_KINDS.size()));
                impact = event.min() + rng.nextDouble() * (event.max() - event.min());
                ret += impact;
                growth += 0.6 * impact;
            }

            long newListeners = Math.max(1000, Math.round(listeners * (1 + growth)));
            ret = Math.max(-props.maxDailyMove(), Math.min(props.maxDailyMove(), ret));
            BigDecimal newPrice = price.multiply(BigDecimal.valueOf(Math.exp(ret))).setScale(2, RoundingMode.HALF_UP);
            if (newPrice.compareTo(MIN_PRICE) < 0) {
                newPrice = MIN_PRICE;
            }

            jdbc.update("UPDATE artists SET prev_price = price, price = ?, listeners = ? WHERE id = ?",
                    newPrice, newListeners, id);
            jdbc.update("INSERT INTO price_history (artist_id, game_date, price, listeners) VALUES (?, ?, ?, ?)",
                    id, date, newPrice, newListeners);

            if (event != null) {
                String headline = String.format(event.headline(), name);
                double impactPct = Math.round(impact * 1000) / 10.0;
                Long eventId = jdbc.queryForObject("""
                        INSERT INTO events (artist_id, type, message, impact_pct, game_date)
                        VALUES (?, ?, ?, ?, ?) RETURNING id""",
                        Long.class, id, event.type(), headline, impactPct, date);
                events.add(new EventDto(eventId, id, ticker, event.type(), headline, impactPct, date, day));
            }
        }
        return new AdvanceDayResult(date, day, artists.size(), events);
    }
}
