package fm.earlysignal.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Hosts like Render hand out DATABASE_URL as postgresql://user:pass@host:port/db, but Spring wants a
 * JDBC URL with separate credentials. This turns the first form into Spring datasource properties.
 * A JDBC URL (jdbc:postgresql://...) is left alone and keeps using DATABASE_USER / DATABASE_PASSWORD.
 */
public final class DatabaseUrl {
    private DatabaseUrl() {}

    public static Map<String, String> toSpringProperties(String url) {
        if (url == null || !(url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
            return Map.of();
        }
        URI uri = URI.create(url);
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
        Map<String, String> props = new LinkedHashMap<>();
        props.put("spring.datasource.url", "jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getRawPath() + query);
        if (uri.getRawUserInfo() != null) {
            String[] userInfo = uri.getRawUserInfo().split(":", 2);
            props.put("spring.datasource.username", decode(userInfo[0]));
            if (userInfo.length > 1) {
                props.put("spring.datasource.password", decode(userInfo[1]));
            }
        }
        return props;
    }

    /** System properties outrank application.properties, so these win over its ${DATABASE_URL} lookup. */
    public static void applyFromEnvironment() {
        toSpringProperties(System.getenv("DATABASE_URL")).forEach(System::setProperty);
    }

    private static String decode(String s) {
        return URLDecoder.decode(s, StandardCharsets.UTF_8);
    }
}
