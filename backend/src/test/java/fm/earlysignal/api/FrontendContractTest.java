package fm.earlysignal.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fm.earlysignal.api.Dtos.EventDto;
import fm.earlysignal.api.Dtos.FanEntry;
import fm.earlysignal.api.Dtos.GameDto;
import fm.earlysignal.api.Dtos.LeaderboardEntry;
import fm.earlysignal.api.Dtos.MarketArtistDto;
import fm.earlysignal.api.Dtos.MarketDto;
import fm.earlysignal.api.Dtos.TransactionDto;
import fm.earlysignal.api.Dtos.UserDto;
import fm.earlysignal.engine.DataSeeder;
import fm.earlysignal.engine.PriceEngine;
import fm.earlysignal.engine.PriceEngine.EventKind;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** The shapes the terminal frontend reads. Needs the docker compose Postgres running. Starts each test from a fresh seed. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FrontendContractTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired DataSeeder seeder;

    @BeforeEach
    void freshSeed() {
        seeder.reset();
    }

    @Test
    void gameDayStartsAtHistoryLength() throws Exception {
        GameDto game = read(mvc.perform(get("/api/game")), GameDto.class);
        assertThat(game.day()).isEqualTo(30);
    }

    @Test
    void marketReturnsEveryArtistWithGenreHistoryAndForecasts() throws Exception {
        long luna = artistId("NETT");
        LocalDate today = gameDate();
        jdbc.update("INSERT INTO forecasts (artist_id, forecast_date, mean, lower, upper) VALUES (?, ?, 10, 9, 11), (?, ?, 10, 9, 11)",
                luna, today, luna, today.plusDays(1));

        MarketDto m = read(mvc.perform(get("/api/market")), MarketDto.class);

        assertThat(m.day()).isEqualTo(30);
        assertThat(m.artists()).hasSize(DataSeeder.SEEDS.size());
        MarketArtistDto a = m.artists().stream().filter(x -> x.ticker().equals("NETT")).findFirst().orElseThrow();
        assertThat(a.name()).isEqualTo("Nettspend");
        assertThat(a.genre()).isEqualTo("Underground Rap");
        assertThat(a.history()).hasSize(31);
        assertThat(a.history().get(0).day()).isZero();
        assertThat(a.history().get(30).day()).isEqualTo(30);
        assertThat(a.history().get(30).price()).isEqualByComparingTo(a.price());
        assertThat(a.change()).isEqualByComparingTo(a.price().subtract(a.history().get(29).price()));
        assertThat(a.forecast()).singleElement().satisfies(f -> assertThat(f.day()).isEqualTo(31));
        assertThat(m.artists()).filteredOn(x -> !x.ticker().equals("NETT"))
                .allSatisfy(x -> assertThat(x.forecast()).isEmpty());
    }

    @Test
    void eventsUseFrontendTypesWithImpactAndDay() throws Exception {
        mvc.perform(post("/api/admin/advance-day").param("days", "30")).andExpect(status().isOk());
        GameDto game = read(mvc.perform(get("/api/game")), GameDto.class);

        List<EventDto> events = read(mvc.perform(get("/api/events").param("limit", "200")), new TypeReference<>() {});

        Map<String, EventKind> kinds = PriceEngine.EVENT_KINDS.stream()
                .collect(Collectors.toMap(EventKind::type, Function.identity()));
        assertThat(events).isNotEmpty().allSatisfy(e -> {
            EventKind k = kinds.get(e.type());
            assertThat(k).as("type %s", e.type()).isNotNull();
            assertThat(e.impactPct()).isBetween(k.min() * 100 - 0.05, k.max() * 100 + 0.05);
            assertThat(e.headline()).isNotBlank();
            assertThat(e.day()).isEqualTo(game.day() - ChronoUnit.DAYS.between(e.date(), game.gameDate()));
        });
    }

    @Test
    void botsCanUseHyphenatedNamesAndKinds() throws Exception {
        UserDto ai = read(createUser("{\"username\":\"ES-GPR\",\"kind\":\"ai\"}"), UserDto.class);
        assertThat(ai.kind()).isEqualTo("ai");
        assertThat(ai.isBot()).isTrue();

        UserDto bot = read(createUser("{\"username\":\"MOMENTUM-BOT\",\"isBot\":true}"), UserDto.class);
        assertThat(bot.kind()).isEqualTo("bot");

        UserDto human = read(createUser("{\"username\":\"beatfiend\"}"), UserDto.class);
        assertThat(human.kind()).isEqualTo("human");
        assertThat(human.isBot()).isFalse();

        createUser("{\"username\":\"robo\",\"kind\":\"robot\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Kind must be human, bot, or ai"));
    }

    @Test
    void leaderboardHasKindAndPrevValue() throws Exception {
        UserDto u = read(createUser("{\"username\":\"lb_tester\",\"kind\":\"ai\"}"), UserDto.class);
        jdbc.update("UPDATE artists SET price = 10.00, prev_price = 8.00 WHERE ticker = 'NETT'");
        trade(u.id(), "NETT", "BUY", 10); // notional 100, fee 1, cash 9899

        List<LeaderboardEntry> board = read(mvc.perform(get("/api/leaderboard").param("limit", "500")), new TypeReference<>() {});

        assertThat(board).filteredOn(e -> e.userId() == u.id()).singleElement().satisfies(e -> {
            assertThat(e.kind()).isEqualTo("ai");
            assertThat(e.totalValue()).isEqualByComparingTo("9999.00");
            assertThat(e.prevValue()).isEqualByComparingTo("9979.00");
        });
    }

    @Test
    void transactionsCarryTheGameDay() throws Exception {
        UserDto u = read(createUser("{\"username\":\"tx_tester\"}"), UserDto.class);
        trade(u.id(), "YEAT", "BUY", 1);

        List<TransactionDto> txs = read(mvc.perform(get("/api/transactions/" + u.id())), new TypeReference<>() {});

        assertThat(txs).singleElement().satisfies(t -> assertThat(t.day()).isEqualTo(30));
    }

    @Test
    void fansRankByFirstBuyAndKeepSoldOutPlayers() throws Exception {
        UserDto early = read(createUser("{\"username\":\"fan_early\"}"), UserDto.class);
        UserDto late = read(createUser("{\"username\":\"fan_late\"}"), UserDto.class);
        UserDto never = read(createUser("{\"username\":\"fan_never\"}"), UserDto.class);
        trade(early.id(), "LUNA", "BUY", 1);
        trade(never.id(), "KAI", "BUY", 1);
        jdbc.update("UPDATE game_state SET game_date = game_date + 1 WHERE id = 1");
        trade(late.id(), "LUNA", "BUY", 2);
        trade(early.id(), "LUNA", "BUY", 1); // a later buy doesn't move your first date
        trade(late.id(), "LUNA", "SELL", 2);

        List<FanEntry> fans = read(mvc.perform(get("/api/artists/" + artistId("LUNA") + "/fans")), new TypeReference<>() {});

        assertThat(fans).extracting(FanEntry::username).containsExactly("fan_early", "fan_late");
        assertThat(fans.get(0)).satisfies(f -> {
            assertThat(f.rank()).isEqualTo(1);
            assertThat(f.day()).isEqualTo(30);
            assertThat(f.shares()).isEqualTo(2);
        });
        assertThat(fans.get(1)).satisfies(f -> {
            assertThat(f.day()).isEqualTo(31);
            assertThat(f.since()).isEqualTo(gameDate());
            assertThat(f.shares()).isZero();
        });
    }

    private ResultActions createUser(String body) throws Exception {
        return mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private void trade(long userId, String ticker, String side, int shares) throws Exception {
        mvc.perform(post("/api/trades").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("userId", userId, "ticker", ticker, "side", side, "shares", shares))))
                .andExpect(status().isOk());
    }

    private long artistId(String ticker) {
        return jdbc.queryForObject("SELECT id FROM artists WHERE ticker = ?", Long.class, ticker);
    }

    private LocalDate gameDate() {
        return jdbc.queryForObject("SELECT game_date FROM game_state WHERE id = 1", LocalDate.class);
    }

    private <T> T read(ResultActions result, Class<T> type) throws Exception {
        return json.readValue(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), type);
    }

    private <T> T read(ResultActions result, TypeReference<T> type) throws Exception {
        return json.readValue(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), type);
    }
}
