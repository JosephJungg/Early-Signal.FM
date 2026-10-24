package fm.earlysignal.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Request and response shapes. These ARE the API contract: change them only after telling the team. */
public final class Dtos {
    private Dtos() {}

    public record CreateUserRequest(String username, Boolean isBot) {}
    public record UserDto(long id, String username, BigDecimal cash, boolean isBot) {}
    public record GameDto(LocalDate gameDate) {}

    public record ArtistDto(long id, String ticker, String name, String tier,
                            BigDecimal price, double changePct, long listeners) {}
    public record PricePoint(LocalDate date, BigDecimal price, long listeners) {}
    public record ForecastPoint(LocalDate date, BigDecimal mean, BigDecimal lower, BigDecimal upper) {}
    public record EventDto(long id, long artistId, String ticker, String type, String message, LocalDate date) {}

    public record HoldingDto(long artistId, String ticker, int shares, BigDecimal avgCost,
                             BigDecimal price, BigDecimal value) {}
    public record PortfolioDto(long userId, String username, BigDecimal cash, BigDecimal holdingsValue,
                               BigDecimal totalValue, List<HoldingDto> holdings) {}

    /** Send either artistId or ticker (ticker makes the terminal command line easy). */
    public record TradeRequest(long userId, Long artistId, String ticker, String side, int shares) {}
    public record TradeResult(long transactionId, String side, String ticker, int shares,
                              BigDecimal price, BigDecimal fee, BigDecimal cash) {}
    public record TransactionDto(long id, long artistId, String ticker, String side, int shares,
                                 BigDecimal price, BigDecimal fee, LocalDate gameDate, OffsetDateTime createdAt) {}

    public record LeaderboardEntry(int rank, long userId, String username, BigDecimal totalValue, boolean isBot) {}
    public record AdvanceDayResult(LocalDate gameDate, int artistsUpdated, List<EventDto> events) {}
    public record ErrorDto(String error) {}
}
