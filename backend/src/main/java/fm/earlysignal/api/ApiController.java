package fm.earlysignal.api;

import fm.earlysignal.api.Dtos.*;
import fm.earlysignal.engine.DataSeeder;
import fm.earlysignal.engine.PriceEngine;
import fm.earlysignal.service.MarketService;
import fm.earlysignal.service.TradeService;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final MarketService market;
    private final TradeService trades;
    private final PriceEngine engine;
    private final DataSeeder seeder;
    private final String adminKey;

    public ApiController(MarketService market, TradeService trades, PriceEngine engine, DataSeeder seeder,
                         @Value("${ADMIN_KEY:}") String adminKey) {
        this.market = market;
        this.trades = trades;
        this.engine = engine;
        this.seeder = seeder;
        this.adminKey = adminKey;
    }

    /** No real login: picking a username creates the player (or returns the existing one). */
    @PostMapping("/users")
    public UserDto createUser(@RequestBody CreateUserRequest req) {
        return market.createOrGetUser(req);
    }

    @GetMapping("/game")
    public GameDto game() {
        return market.game();
    }

    /** One call for the whole terminal: every artist with quote, history, and forecasts. */
    @GetMapping("/market")
    public MarketDto marketSnapshot() {
        return market.market();
    }

    @GetMapping("/artists")
    public List<ArtistDto> artists() {
        return market.artists();
    }

    @GetMapping("/artists/{id}/history")
    public List<PricePoint> history(@PathVariable long id) {
        return market.history(id);
    }

    @GetMapping("/artists/{id}/forecast")
    public List<ForecastPoint> forecast(@PathVariable long id) {
        return market.forecast(id);
    }

    @GetMapping("/events")
    public List<EventDto> events(@RequestParam(defaultValue = "20") int limit) {
        return market.events(limit);
    }

    @GetMapping("/portfolio/{userId}")
    public PortfolioDto portfolio(@PathVariable long userId) {
        return market.portfolio(userId);
    }

    @PostMapping("/trades")
    public TradeResult trade(@RequestBody TradeRequest req) {
        return trades.execute(req);
    }

    @GetMapping("/transactions/{userId}")
    public List<TransactionDto> transactions(@PathVariable long userId) {
        return market.transactions(userId);
    }

    @GetMapping("/leaderboard")
    public List<LeaderboardEntry> leaderboard(@RequestParam(defaultValue = "50") int limit) {
        return market.leaderboard(limit);
    }

    /** The demo button. Set the ADMIN_KEY env var in production and send it as X-Admin-Key. */
    @PostMapping("/admin/advance-day")
    public List<AdvanceDayResult> advanceDay(@RequestParam(defaultValue = "1") int days,
                                             @RequestHeader(value = "X-Admin-Key", required = false) String key) {
        checkAdminKey(key);
        List<AdvanceDayResult> results = new ArrayList<>();
        for (int i = 0; i < Math.min(Math.max(days, 1), 30); i++) {
            results.add(engine.advanceDay());
        }
        return results;
    }

    /** One command back to a clean demo: wipes users, trades, and forecasts, then reseeds the market. */
    @PostMapping("/admin/reset")
    public GameDto reset(@RequestHeader(value = "X-Admin-Key", required = false) String key) {
        checkAdminKey(key);
        seeder.reset();
        return market.game();
    }

    private void checkAdminKey(String key) {
        if (!adminKey.isEmpty() && !adminKey.equals(key)) {
            throw new GameException(HttpStatus.FORBIDDEN, "Bad admin key");
        }
    }
}
