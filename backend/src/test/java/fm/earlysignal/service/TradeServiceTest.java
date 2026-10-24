package fm.earlysignal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fm.earlysignal.api.Dtos.CreateUserRequest;
import fm.earlysignal.api.Dtos.PortfolioDto;
import fm.earlysignal.api.Dtos.TradeRequest;
import fm.earlysignal.api.Dtos.TradeResult;
import fm.earlysignal.api.GameException;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** Needs the docker compose Postgres running. Every test uses a fresh player and pins LUNA at 10.00. */
@SpringBootTest
@ActiveProfiles("test")
class TradeServiceTest {
    @Autowired TradeService trades;
    @Autowired MarketService market;
    @Autowired JdbcTemplate jdbc;

    long userId;

    @BeforeEach
    void setUp() {
        String username = "t_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        userId = market.createOrGetUser(new CreateUserRequest(username, false)).id();
        setPrice("LUNA", "10.00");
    }

    @Test
    void buyChargesOnePercentFee() {
        TradeResult r = buy("LUNA", 100);

        assertThat(r.fee()).isEqualByComparingTo("10.00");
        assertThat(r.cash()).isEqualByComparingTo("8990.00");
        PortfolioDto p = market.portfolio(userId);
        assertThat(p.holdings()).singleElement().satisfies(h -> {
            assertThat(h.shares()).isEqualTo(100);
            assertThat(h.avgCost()).isEqualByComparingTo("10.00");
        });
    }

    @Test
    void sellCreditsProceedsMinusFee() {
        buy("LUNA", 100);
        setPrice("LUNA", "20.00");

        TradeResult r = sell("LUNA", 50);

        assertThat(r.fee()).isEqualByComparingTo("10.00");
        assertThat(r.cash()).isEqualByComparingTo("9980.00"); // 8990 + 1000 - 10
        assertThat(market.portfolio(userId).holdings()).singleElement()
                .satisfies(h -> assertThat(h.shares()).isEqualTo(50));
    }

    @Test
    void sellingEverythingRemovesTheHolding() {
        buy("LUNA", 10);
        sell("LUNA", 10);

        assertThat(market.portfolio(userId).holdings()).isEmpty();
    }

    @Test
    void averageCostBlendsAcrossBuys() {
        buy("LUNA", 100);
        setPrice("LUNA", "20.00");
        buy("LUNA", 50);

        assertThat(market.portfolio(userId).holdings()).singleElement()
                .satisfies(h -> assertThat(h.avgCost()).isEqualByComparingTo("13.33"));
    }

    @Test
    void positionCapAllowsUpToThirtyPercent() {
        // 299 shares: total after fee is 9970.10, cap 2991.03, position 2990
        buy("LUNA", 299);
    }

    @Test
    void positionCapRejectsAboveThirtyPercent() {
        // 300 shares: total after fee is 9970.00, cap 2991.00, position 3000
        assertGameError(() -> buy("LUNA", 300), HttpStatus.BAD_REQUEST, "Position limit");
        assertThat(cash()).isEqualByComparingTo("10000.00");
    }

    @Test
    void rejectsBuyPastAvailableCash() {
        setPrice("LUNA", "1000.00");
        assertGameError(() -> buy("LUNA", 20), HttpStatus.BAD_REQUEST, "Insufficient credits");
    }

    @Test
    void rejectsSellingMoreThanHeld() {
        buy("LUNA", 5);
        assertGameError(() -> sell("LUNA", 6), HttpStatus.BAD_REQUEST, "You only hold 5");
    }

    @Test
    void rejectsBadInput() {
        assertGameError(() -> trades.execute(new TradeRequest(userId, null, "LUNA", "HOLD", 1)),
                HttpStatus.BAD_REQUEST, "Side must be");
        assertGameError(() -> buy("LUNA", 0), HttpStatus.BAD_REQUEST, "positive");
        assertGameError(() -> buy("NOPE", 1), HttpStatus.NOT_FOUND, "Unknown artist");
        assertGameError(() -> trades.execute(new TradeRequest(-1, null, "LUNA", "BUY", 1)),
                HttpStatus.NOT_FOUND, "Unknown user");
    }

    @Test
    void tradesAreRecordedInHistory() {
        buy("LUNA", 3);
        sell("LUNA", 1);

        assertThat(market.transactions(userId)).extracting(t -> t.side()).containsExactlyInAnyOrder("BUY", "SELL");
    }

    private TradeResult buy(String ticker, int shares) {
        return trades.execute(new TradeRequest(userId, null, ticker, "buy", shares));
    }

    private TradeResult sell(String ticker, int shares) {
        return trades.execute(new TradeRequest(userId, null, ticker, "SELL", shares));
    }

    private void setPrice(String ticker, String price) {
        jdbc.update("UPDATE artists SET price = ?, prev_price = ? WHERE ticker = ?",
                new BigDecimal(price), new BigDecimal(price), ticker);
    }

    private BigDecimal cash() {
        return jdbc.queryForObject("SELECT cash FROM users WHERE id = ?", BigDecimal.class, userId);
    }

    private static void assertGameError(Runnable call, HttpStatus status, String messagePart) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(GameException.class, e -> assertThat(e.status()).isEqualTo(status))
                .hasMessageContaining(messagePart);
    }
}
