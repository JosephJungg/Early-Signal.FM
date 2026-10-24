package fm.earlysignal.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "game")
public record GameProperties(
        BigDecimal startingCash,
        double feeRate,
        double maxPositionPct,
        double maxDailyMove,
        int historyDays,
        boolean dailyUpdateEnabled) {
}
