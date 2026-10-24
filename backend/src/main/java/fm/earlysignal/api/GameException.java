package fm.earlysignal.api;

import org.springframework.http.HttpStatus;

public class GameException extends RuntimeException {
    private final HttpStatus status;

    public GameException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static GameException badRequest(String message) {
        return new GameException(HttpStatus.BAD_REQUEST, message);
    }

    public static GameException notFound(String message) {
        return new GameException(HttpStatus.NOT_FOUND, message);
    }

    public HttpStatus status() {
        return status;
    }
}
