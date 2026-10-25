package fm.earlysignal.engine;

import fm.earlysignal.config.GameProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * On first start (empty artists table): seeds fictional artists, then runs the price engine
 * historyDays times so charts, events, and changes look alive immediately.
 * The roster matches the frontend mock (frontend/src/mock/engine.js) so the swap to the live API is seamless.
 * Swap these for real artists once Joseph's listener data is ready.
 */
@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    public record Seed(String ticker, String name, String genre, double price, long listeners, double drift, double vol) {}

    public static final List<Seed> SEEDS = List.of(
            new Seed("NETT", "Nettspend", "Underground Rap", 18.4, 1_840_000, 0.010, 0.045),
            new Seed("YEAT", "Yeat", "Rage Rap", 42.1, 6_200_000, 0.004, 0.030),
            new Seed("MKG", "Mk.gee", "Alt R&B", 27.6, 3_100_000, 0.006, 0.035),
            new Seed("WISP", "Wisp", "Shoegaze", 12.9, 920_000, 0.003, 0.050),
            new Seed("CLR", "Clairo", "Indie Pop", 35.2, 4_700_000, 0.008, 0.032),
            new Seed("FMNK", "Fakemink", "UK Underground Rap", 6.4, 310_000, 0.000, 0.070),
            new Seed("JANE", "Jane Remover", "Hyperpop", 9.8, 640_000, 0.007, 0.055),
            new Seed("SNOW", "Snow Strippers", "Electronic", 22.3, 2_250_000, 0.005, 0.040),
            new Seed("LAUF", "Laufey", "Jazz Pop", 51.7, 9_800_000, 0.003, 0.022),
            new Seed("WYAT", "Wyatt Flores", "Country", 30.5, 3_600_000, 0.002, 0.025),
            new Seed("OSA", "OsamaSon", "Rage Rap", 4.2, 180_000, 0.012, 0.085),
            new Seed("LNKR", "Adrianne Lenker", "Indie Folk", 14.6, 1_120_000, 0.001, 0.030),
            new Seed("KNKL", "Knocked Loose", "Metal", 11.3, 780_000, -0.001, 0.038),
            new Seed("KEN", "Ken Carson", "Rage Rap", 46.8, 8_100_000, 0.004, 0.028),
            new Seed("ODTR", "Odetari", "EDM", 19.9, 2_000_000, -0.002, 0.042),
            new Seed("BLDE", "Bladee", "Cloud Rap", 7.1, 520_000, 0.006, 0.048),
            new Seed("WALL", "Wallows", "Alt Rock", 16.2, 1_380_000, 0.001, 0.036),
            new Seed("HOVV", "Hovvdy", "Indie Folk", 10.4, 700_000, 0.004, 0.040),
            new Seed("HOLS", "2hollis", "Hyperpop", 5.6, 260_000, 0.011, 0.075),
            new Seed("DISC", "Disco Lines", "House", 24.8, 2_600_000, 0.003, 0.033),
            new Seed("FAYE", "Faye Webster", "Singer-Songwriter", 21.5, 2_050_000, 0.005, 0.031),
            new Seed("GLVE", "Glaive", "Hyperpop", 8.9, 590_000, 0.002, 0.044),
            new Seed("DSTRY", "Destroy Lonely", "Rage Rap", 13.7, 1_450_000, 0.006, 0.058),
            new Seed("CHAP", "Chappell Roan", "Pop", 61.3, 12_400_000, 0.002, 0.020),
            new Seed("BEA", "Beabadoobee", "Indie Rock", 48.5, 7_400_000, 0.003, 0.024),
            new Seed("DOM", "Dominic Fike", "Alt Pop", 39.9, 5_600_000, 0.003, 0.027),
            new Seed("MRIA", "The Marías", "Dream Pop", 26.4, 3_400_000, 0.007, 0.036),
            new Seed("ETHL", "Ethel Cain", "Gothic Americana", 23.1, 2_800_000, 0.007, 0.040),
            new Seed("MTOD", "Malcolm Todd", "Bedroom Pop", 6.8, 430_000, 0.011, 0.065),
            new Seed("JVB", "Joey Valence & Brae", "Hip-Hop", 8.2, 610_000, 0.008, 0.060),
            new Seed("QUAD", "Quadeca", "Art Rap", 9.6, 820_000, 0.005, 0.045),
            new Seed("ECCO", "Ecco2k", "Experimental Pop", 7.4, 560_000, 0.004, 0.058),
            new Seed("LUCY", "Lucy Bedroque", "Underground Rap", 3.9, 150_000, 0.012, 0.090),
            new Seed("FENG", "Feng", "Underground Rap", 4.6, 210_000, 0.011, 0.085),
            new Seed("MAC", "Mac DeMarco", "Indie Rock", 28.7, 3_900_000, -0.001, 0.030));

    private final JdbcTemplate jdbc;
    private final PriceEngine engine;
    private final GameProperties props;

    public DataSeeder(JdbcTemplate jdbc, PriceEngine engine, GameProperties props) {
        this.jdbc = jdbc;
        this.engine = engine;
        this.props = props;
    }

    @Override
    public void run(String... args) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM artists", Integer.class);
        if (count != null && count > 0) {
            return;
        }
        seed();
    }

    /**
     * Wipes every table (users, trades, forecasts too) and reseeds, all in one transaction.
     * Artist ids restart at 1 in the same order, so the ML job can rerun against the same ids.
     */
    @Transactional
    public void reset() {
        jdbc.execute("""
                TRUNCATE forecasts, events, transactions, holdings, price_history, artists, users, game_state
                RESTART IDENTITY CASCADE""");
        seed();
        log.info("Database reset to a clean demo state");
    }

    private void seed() {
        LocalDate start = LocalDate.now(ZoneId.of("America/Los_Angeles")).minusDays(props.historyDays());
        jdbc.update("INSERT INTO game_state (id, game_date) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET game_date = ?",
                start, start);

        for (Seed s : SEEDS) {
            String tier = s.listeners() >= 5_000_000 ? "BLUE_CHIP" : s.listeners() >= 1_000_000 ? "MID" : "UNDERGROUND";
            BigDecimal price = BigDecimal.valueOf(s.price()).setScale(2);
            Long id = jdbc.queryForObject("""
                    INSERT INTO artists (ticker, name, genre, tier, volatility, drift, price, prev_price, listeners)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                    Long.class, s.ticker(), s.name(), s.genre(), tier, s.vol(), s.drift(), price, price, s.listeners());
            jdbc.update("INSERT INTO price_history (artist_id, game_date, price, listeners) VALUES (?, ?, ?, ?)",
                    id, start, price, s.listeners());
        }
        for (int i = 0; i < props.historyDays(); i++) {
            engine.advanceDay();
        }
        log.info("Seeded {} artists with {} days of history", SEEDS.size(), props.historyDays());
    }
}
