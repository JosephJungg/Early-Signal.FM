package fm.earlysignal.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Request and response shapes. These ARE the API contract: change them only after telling the team.
 * "day" fields count game days from the first day of seeded history (day 0), matching the terminal's DAY counter.
 */
public final class Dtos {
    private Dtos() {}

    /** kind is human, bot, or ai; isBot alone still works and means kind "bot". */
    public record CreateUserRequest(String username, Boolean isBot, String kind) {}
    public record UserDto(long id, String username, BigDecimal cash, boolean isBot, String kind) {}
    public record GameDto(LocalDate gameDate, long day) {}

    public record ArtistDto(long id, String ticker, String name, String genre, String tier,
                            BigDecimal price, double changePct, long listeners) {}
    public record PricePoint(LocalDate date, long day, BigDecimal price, long listeners) {}
    public record ForecastPoint(LocalDate date, long day, BigDecimal mean, BigDecimal lower, BigDecimal upper) {}
    public record EventDto(long id, long artistId, String ticker, String type, String headline,
                           double impactPct, LocalDate date, long day) {}

    /** One artist in GET /api/market: quote, full price history, and forecasts after the game date. */
    public record MarketArtistDto(long id, String ticker, String name, String genre, String tier,
                                  BigDecimal price, BigDecimal change, double changePct,
                                  long listeners, double listenersChangePct,
                                  List<PricePoint> history, List<ForecastPoint> forecast) {}
    public record MarketDto(LocalDate gameDate, long day, List<MarketArtistDto> artists) {}

    public record HoldingDto(long artistId, String ticker, int shares, BigDecimal avgCost,
                             BigDecimal price, BigDecimal value) {}
    public record PortfolioDto(long userId, String username, BigDecimal cash, BigDecimal holdingsValue,
                               BigDecimal totalValue, List<HoldingDto> holdings) {}

    /** Send either artistId or ticker (ticker makes the terminal command line easy). */
    public record TradeRequest(long userId, Long artistId, String ticker, String side, int shares) {}
    public record TradeResult(long transactionId, String side, String ticker, int shares,
                              BigDecimal price, BigDecimal fee, BigDecimal cash) {}
    public record TransactionDto(long id, long artistId, String ticker, String side, int shares,
                                 BigDecimal price, BigDecimal fee, LocalDate gameDate, long day,
                                 OffsetDateTime createdAt) {}

    /** prevValue is cash plus holdings at yesterday's prices, for the 1D column. */
    public record LeaderboardEntry(int rank, long userId, String username, String kind, boolean isBot,
                                   BigDecimal totalValue, BigDecimal prevValue) {}
    public record AdvanceDayResult(LocalDate gameDate, long day, int artistsUpdated, List<EventDto> events) {}
    public record ErrorDto(String error) {}
}
