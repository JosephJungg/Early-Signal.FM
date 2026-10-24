package fm.earlysignal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class EarlysignalApplication {
    public static void main(String[] args) {
        SpringApplication.run(EarlysignalApplication.class, args);
    }
}
