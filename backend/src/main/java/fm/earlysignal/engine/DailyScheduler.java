package fm.earlysignal.engine;

import fm.earlysignal.config.GameProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Real daily update at midnight Pacific. The Advance Day endpoint runs the same code on demand. */
@Component
public class DailyScheduler {
    private final PriceEngine engine;
    private final GameProperties props;

    public DailyScheduler(PriceEngine engine, GameProperties props) {
        this.engine = engine;
        this.props = props;
    }

    @Scheduled(cron = "0 0 0 * * *", zone = "America/Los_Angeles")
    public void daily() {
        if (props.dailyUpdateEnabled()) {
            engine.advanceDay();
        }
    }
}
