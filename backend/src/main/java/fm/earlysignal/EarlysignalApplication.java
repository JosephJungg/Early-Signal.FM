package fm.earlysignal;

import fm.earlysignal.config.DatabaseUrl;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class EarlysignalApplication {
    public static void main(String[] args) {
        DatabaseUrl.applyFromEnvironment();
        SpringApplication.run(EarlysignalApplication.class, args);
    }
}
