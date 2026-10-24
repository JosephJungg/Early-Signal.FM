package fm.earlysignal.engine;

import fm.earlysignal.api.Dtos.AdvanceDayResult;
import fm.earlysignal.api.Dtos.EventDto;
import fm.earlysignal.config.GameProperties;
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
 * listener growth g = drift + noise, plus event shocks (viral spike, listener drop)
 * daily log return  = 0.8 * g + releaseBoost + volatility * N(0,1), clamped to +/- maxDailyMove
 * new price         = old price * exp(return)
 *
 * When Teammate 3's real listener data is ready, replace simulateListenerGrowth with a lookup.
 */
@Service
public class PriceEngine {
    private static final double LISTENER_WEIGHT = 0.8;
    private static final BigDecimal MIN_PRICE = new BigDecimal("0.50");

    private final JdbcTemplate jdbc;
    private final GameProperties props;
    private final Random rng = new Random();

    public PriceEngine(JdbcTemplate jdbc, GameProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    @Transactional
    public AdvanceDayResult advanceDay() {
        LocalDate date = jdbc.queryForObject(
                "UPDATE game_state SET game_date = game_date + 1 WHERE id = 1 RETURNING game_date", LocalDate.class);

        // Lock all artists so trades wait while prices change.
        List<Map<String, Object>> artists = jdbc.queryForList("SELECT * FROM artists ORDER BY id FOR UPDATE");
        List<EventDto> events = new ArrayList<>();

        for (Map<String, Object> a : artists) {
            long id = ((Number) a.get("id")).longValue();
            String ticker = (String) a.get("ticker");
            String tier = (String) a.get("tier");
            double vol = ((Number) a.get("volatility")).doubleValue();
            double drift = ((Number) a.get("drift")).doubleValue();
            double releaseBoost = ((Number) a.get("release_boost")).doubleValue();
            long listeners = ((Number) a.get("listeners")).longValue();
            BigDecimal price = (BigDecimal) a.get("price");

            double growth = drift + 0.5 * vol * rng.nextGaussian();
            String eventType = null;
            double roll = rng.nextDouble();
            double pViral = switch (tier) {
                case "UNDERGROUND" -> 0.04;
                case "MID" -> 0.02;
                default -> 0.005;
            };
            double pDrop = tier.equals("UNDERGROUND") ? 0.03 : 0.015;
            double pRelease = 0.03;

            if (roll < pViral) {
                growth += 0.15 + 0.25 * rng.nextDouble();
                eventType = "VIRAL_SPIKE";
            } else if (roll < pViral + pDrop) {
                growth -= 0.08 + 0.12 * rng.nextDouble();
                eventType = "LISTENER_DROP";
            } else if (roll < pViral + pDrop + pRelease) {
                releaseBoost = 0.06;
                eventType = "NEW_RELEASE";
            }

            long newListeners = Math.max(1000, Math.round(listeners * (1 + growth)));
            double ret = LISTENER_WEIGHT * growth + releaseBoost + vol * rng.nextGaussian();
            ret = Math.max(-props.maxDailyMove(), Math.min(props.maxDailyMove(), ret));
            BigDecimal newPrice = price.multiply(BigDecimal.valueOf(Math.exp(ret))).setScale(2, RoundingMode.HALF_UP);
            if (newPrice.compareTo(MIN_PRICE) < 0) {
                newPrice = MIN_PRICE;
            }
            double nextBoost = releaseBoost * 0.5;
            if (nextBoost < 0.005) {
                nextBoost = 0;
            }

            jdbc.update("""
                    UPDATE artists SET prev_price = price, price = ?, listeners = ?, release_boost = ? WHERE id = ?""",
                    newPrice, newListeners, nextBoost, id);
            jdbc.update("INSERT INTO price_history (artist_id, game_date, price, listeners) VALUES (?, ?, ?, ?)",
                    id, date, newPrice, newListeners);

            if (eventType != null) {
                double pricePct = newPrice.subtract(price).divide(price, 4, RoundingMode.HALF_UP).doubleValue() * 100;
                double listenerPct = (newListeners - listeners) * 100.0 / listeners;
                String message = switch (eventType) {
                    case "VIRAL_SPIKE" -> String.format("VIRAL SPIKE: %s listeners %+.0f%%, price %+.1f%%",
                            ticker, listenerPct, pricePct);
                    case "LISTENER_DROP" -> String.format("LISTENER DROP: %s listeners %+.0f%%, price %+.1f%%",
                            ticker, listenerPct, pricePct);
                    default -> String.format("NEW RELEASE: %s drops new music, price %+.1f%%", ticker, pricePct);
                };
                Long eventId = jdbc.queryForObject(
                        "INSERT INTO events (artist_id, type, message, game_date) VALUES (?, ?, ?, ?) RETURNING id",
                        Long.class, id, eventType, message, date);
                events.add(new EventDto(eventId, id, ticker, eventType, message, date));
            }
        }
        return new AdvanceDayResult(date, artists.size(), events);
    }
}
