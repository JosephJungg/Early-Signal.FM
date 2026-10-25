package fm.earlysignal.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DatabaseUrlTest {

    @Test
    void renderStyleUrlBecomesJdbcPlusCredentials() {
        assertThat(DatabaseUrl.toSpringProperties("postgresql://es_user:s3cr%40t@dpg-abc123-a/earlysignal_db"))
                .containsEntry("spring.datasource.url", "jdbc:postgresql://dpg-abc123-a:5432/earlysignal_db")
                .containsEntry("spring.datasource.username", "es_user")
                .containsEntry("spring.datasource.password", "s3cr@t");
    }

    @Test
    void keepsPortAndQuery() {
        assertThat(DatabaseUrl.toSpringProperties("postgres://u:p@db.example.com:6543/game?sslmode=require"))
                .containsEntry("spring.datasource.url", "jdbc:postgresql://db.example.com:6543/game?sslmode=require");
    }

    @Test
    void leavesJdbcUrlsAndMissingValuesAlone() {
        assertThat(DatabaseUrl.toSpringProperties("jdbc:postgresql://localhost:5432/earlysignal")).isEmpty();
        assertThat(DatabaseUrl.toSpringProperties(null)).isEmpty();
    }
}
