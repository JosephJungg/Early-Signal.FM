package fm.earlysignal.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fm.earlysignal.engine.DataSeeder;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Needs the docker compose Postgres running. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void malformedJsonIs400WithErrorBody() throws Exception {
        mvc.perform(post("/api/trades").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Malformed JSON body"));
    }

    @Test
    void wrongPathTypeIs400WithErrorBody() throws Exception {
        mvc.perform(get("/api/artists/abc/history"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void unknownPathIs404WithErrorBody() throws Exception {
        mvc.perform(get("/api/nope"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void forecastSkipsDatesNotAfterGameDate() throws Exception {
        long artistId = jdbc.queryForObject("SELECT id FROM artists WHERE ticker = 'LUNA'", Long.class);
        LocalDate today = jdbc.queryForObject("SELECT game_date FROM game_state WHERE id = 1", LocalDate.class);
        jdbc.update("DELETE FROM forecasts WHERE artist_id = ?", artistId);
        for (LocalDate d : new LocalDate[] {today.minusDays(1), today, today.plusDays(1), today.plusDays(2)}) {
            jdbc.update("INSERT INTO forecasts (artist_id, forecast_date, mean, lower, upper) VALUES (?, ?, 10, 9, 11)",
                    artistId, d);
        }

        mvc.perform(get("/api/artists/" + artistId + "/forecast"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].date").value(today.plusDays(1).toString()));
    }

    @Test
    void resetWipesPlayersAndReseedsMarket() throws Exception {
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"reset_me\"}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/admin/reset")).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM artists", Integer.class)).isEqualTo(DataSeeder.SEEDS.size());
        assertThat(jdbc.queryForObject("SELECT MIN(id) FROM artists", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM price_history", Integer.class)).isEqualTo(DataSeeder.SEEDS.size() * 31);
    }
}
