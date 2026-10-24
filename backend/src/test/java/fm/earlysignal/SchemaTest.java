package fm.earlysignal;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runs schema.sql against a brand-new, empty schema, so columns that only exist in long-lived
 * dev databases can't hide a missing CREATE TABLE column. Needs the docker compose Postgres running.
 */
@SpringBootTest
@ActiveProfiles("test")
class SchemaTest {
    private static final String FRESH = "es_fresh_schema";

    @Autowired JdbcTemplate jdbc;

    @Test
    void freshSchemaHasColumnsTheMlJobReads() {
        List<String> artistColumns = jdbc.execute((ConnectionCallback<List<String>>) conn -> {
            try (var st = conn.createStatement()) {
                st.execute("DROP SCHEMA IF EXISTS " + FRESH + " CASCADE");
                st.execute("CREATE SCHEMA " + FRESH);
                st.execute("SET search_path TO " + FRESH);
                try {
                    ScriptUtils.executeSqlScript(conn, new ClassPathResource("schema.sql"));
                    // The exact query ml/db.py runs.
                    st.executeQuery("SELECT id, ticker, tier, release_boost FROM artists ORDER BY id").close();
                    List<String> cols = new ArrayList<>();
                    try (ResultSet rs = st.executeQuery("""
                            SELECT column_name FROM information_schema.columns
                            WHERE table_schema = '%s' AND table_name = 'artists'""".formatted(FRESH))) {
                        while (rs.next()) {
                            cols.add(rs.getString(1));
                        }
                    }
                    return cols;
                } finally {
                    st.execute("SET search_path TO es_test");
                    st.execute("DROP SCHEMA " + FRESH + " CASCADE");
                }
            }
        });

        assertThat(artistColumns).contains("release_boost", "tier", "genre");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM artists WHERE release_boost <> 0", Integer.class)).isZero();
    }
}
