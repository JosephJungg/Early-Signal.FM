package fm.earlysignal.api;

import fm.earlysignal.api.Dtos.ErrorDto;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Every error comes back as {"error": "..."} so the terminal can print it directly.
 * Spring's own request errors (bad JSON, wrong param type, unknown path) keep their 4xx status.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(GameException.class)
    public ResponseEntity<ErrorDto> game(GameException e) {
        return ResponseEntity.status(e.status()).body(new ErrorDto(e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorDto> other(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorDto("Server error: " + e.getMessage()));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
                                                             HttpStatusCode status, WebRequest request) {
        String message;
        if (ex instanceof HttpMessageNotReadableException) {
            message = "Malformed JSON body";
        } else if (body instanceof ProblemDetail pd && pd.getDetail() != null) {
            message = pd.getDetail();
        } else {
            message = ex.getMessage();
        }
        return ResponseEntity.status(status).headers(headers).body(new ErrorDto(message));
    }
}
