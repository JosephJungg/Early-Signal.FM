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
 * Swap these for real artists once Teammate 3's listener data is ready.
 */
@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    record Seed(String ticker, String name, String tier, double price, long listeners) {}

    private static final List<Seed> SEEDS = List.of(
            new Seed("ORIN", "Orion Kade", "BLUE_CHIP", 245.00, 48_000_000),
            new Seed("SOL", "Solace", "BLUE_CHIP", 198.50, 41_500_000),
            new Seed("MARA", "Mara Quinn", "BLUE_CHIP", 176.20, 36_200_000),
            new Seed("JUNO", "Juno Ray", "BLUE_CHIP", 154.75, 31_800_000),
            new Seed("ATLS", "Atlas Grey", "BLUE_CHIP", 132.40, 27_400_000),
            new Seed("KAI", "Kai Mercer", "MID", 78.30, 7_600_000),
            new Seed("VELA", "Vela Hart", "MID", 64.10, 5_900_000),
            new Seed("NOVA", "Nova Bloom", "MID", 58.90, 5_100_000),
            new Seed("REX", "Rex Arden", "MID", 51.25, 4_300_000),
            new Seed("IVY", "Ivy Lane", "MID", 46.60, 3_700_000),
            new Seed("TIDE", "Talon and the Tide", "MID", 42.15, 3_100_000),
            new Seed("ECHO", "Echo Park Kids", "MID", 38.80, 2_400_000),
            new Seed("LUNA", "Luna Vale", "UNDERGROUND", 18.40, 380_000),
            new Seed("MOTH", "Moth Radio", "UNDERGROUND", 15.20, 310_000),
            new Seed("FERN", "Fern Atlas", "UNDERGROUND", 12.75, 245_000),
            new Seed("GLOW", "Glowworm Choir", "UNDERGROUND", 10.90, 190_000),
            new Seed("DUSK", "Dusk Theory", "UNDERGROUND", 9.35, 150_000),
            new Seed("PIXL", "Pixel Saints", "UNDERGROUND", 7.80, 112_000),
            new Seed("RUE", "Rue Marlow", "UNDERGROUND", 6.40, 84_000),
            new Seed("ZEPH", "Zephyr Static", "UNDERGROUND", 5.10, 56_000));

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
            double vol = switch (s.tier()) {
                case "BLUE_CHIP" -> 0.012;
                case "MID" -> 0.025;
                default -> 0.05;
            };
            double drift = switch (s.tier()) {
                case "BLUE_CHIP" -> 0.001;
                case "MID" -> 0.003;
                default -> 0.006;
            };
            BigDecimal price = BigDecimal.valueOf(s.price());
            Long id = jdbc.queryForObject("""
                    INSERT INTO artists (ticker, name, tier, volatility, drift, price, prev_price, listeners)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                    Long.class, s.ticker(), s.name(), s.tier(), vol, drift, price, price, s.listeners());
            jdbc.update("INSERT INTO price_history (artist_id, game_date, price, listeners) VALUES (?, ?, ?, ?)",
                    id, start, price, s.listeners());
        }
        for (int i = 0; i < props.historyDays(); i++) {
            engine.advanceDay();
        }
        log.info("Seeded {} artists with {} days of history", SEEDS.size(), props.historyDays());
    }
}
