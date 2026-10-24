package fm.earlysignal.service;

import fm.earlysignal.api.Dtos.TradeRequest;
import fm.earlysignal.api.Dtos.TradeResult;
import fm.earlysignal.api.GameException;
import fm.earlysignal.config.GameProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Executes buys and sells. Everything happens in one database transaction with the user's row
 * locked, so two fast clicks (or a bot and a human) can never double-spend the same cash.
 */
@Service
public class TradeService {
    private final JdbcTemplate jdbc;
    private final GameProperties props;
    private final MarketService market;

    public TradeService(JdbcTemplate jdbc, GameProperties props, MarketService market) {
        this.jdbc = jdbc;
        this.props = props;
        this.market = market;
    }

    @Transactional
    public TradeResult execute(TradeRequest req) {
        String side = req.side() == null ? "" : req.side().trim().toUpperCase();
        if (!side.equals("BUY") && !side.equals("SELL")) {
            throw GameException.badRequest("Side must be BUY or SELL");
        }
        if (req.shares() <= 0) {
            throw GameException.badRequest("Shares must be a positive whole number");
        }
        long artistId = market.resolveArtistId(req.artistId(), req.ticker());

        // Lock the user's row for the rest of this transaction.
        BigDecimal cash;
        try {
            cash = jdbc.queryForObject("SELECT cash FROM users WHERE id = ? FOR UPDATE", BigDecimal.class, req.userId());
        } catch (EmptyResultDataAccessException e) {
            throw GameException.notFound("Unknown user: " + req.userId());
        }
        // FOR SHARE makes a concurrent Advance Day wait until this trade finishes.
        Map<String, Object> artist = jdbc.queryForMap("SELECT ticker, price FROM artists WHERE id = ? FOR SHARE", artistId);
        String ticker = (String) artist.get("ticker");
        BigDecimal price = (BigDecimal) artist.get("price");

        BigDecimal shares = BigDecimal.valueOf(req.shares());
        BigDecimal notional = price.multiply(shares).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fee = notional.multiply(BigDecimal.valueOf(props.feeRate())).setScale(2, RoundingMode.HALF_UP);

        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT shares, avg_cost FROM holdings WHERE user_id = ? AND artist_id = ?", req.userId(), artistId);
        int heldShares = existing.isEmpty() ? 0 : ((Number) existing.get(0).get("shares")).intValue();
        BigDecimal avgCost = existing.isEmpty() ? BigDecimal.ZERO : (BigDecimal) existing.get(0).get("avg_cost");

        BigDecimal newCash;
        if (side.equals("BUY")) {
            BigDecimal totalCost = notional.add(fee);
            if (cash.compareTo(totalCost) < 0) {
                throw GameException.badRequest("Insufficient credits: need " + totalCost + ", have " + cash);
            }
            newCash = cash.subtract(totalCost);

            // Position limit: after the trade, this artist can be at most 30% of total portfolio value.
            BigDecimal holdingsValue = jdbc.queryForObject("""
                    SELECT COALESCE(SUM(h.shares * a.price), 0) FROM holdings h
                    JOIN artists a ON a.id = h.artist_id WHERE h.user_id = ?""", BigDecimal.class, req.userId());
            BigDecimal portfolioAfter = newCash.add(holdingsValue).add(notional);
            int newShares = heldShares + req.shares();
            BigDecimal positionAfter = price.multiply(BigDecimal.valueOf(newShares));
            BigDecimal cap = portfolioAfter.multiply(BigDecimal.valueOf(props.maxPositionPct()));
            if (positionAfter.compareTo(cap) > 0) {
                int maxTotal = cap.divide(price, 0, RoundingMode.FLOOR).intValue();
                int canBuy = Math.max(0, maxTotal - heldShares);
                throw GameException.badRequest("Position limit: max " + Math.round(props.maxPositionPct() * 100)
                        + "% of portfolio in one artist. You can buy about " + canBuy + " more " + ticker);
            }

            BigDecimal newAvg = avgCost.multiply(BigDecimal.valueOf(heldShares)).add(notional)
                    .divide(BigDecimal.valueOf(newShares), 2, RoundingMode.HALF_UP);
            jdbc.update("""
                    INSERT INTO holdings (user_id, artist_id, shares, avg_cost) VALUES (?, ?, ?, ?)
                    ON CONFLICT (user_id, artist_id) DO UPDATE SET shares = EXCLUDED.shares, avg_cost = EXCLUDED.avg_cost""",
                    req.userId(), artistId, newShares, newAvg);
        } else {
            if (heldShares < req.shares()) {
                throw GameException.badRequest("You only hold " + heldShares + " shares of " + ticker);
            }
            newCash = cash.add(notional).subtract(fee);
            int remaining = heldShares - req.shares();
            if (remaining == 0) {
                jdbc.update("DELETE FROM holdings WHERE user_id = ? AND artist_id = ?", req.userId(), artistId);
            } else {
                jdbc.update("UPDATE holdings SET shares = ? WHERE user_id = ? AND artist_id = ?",
                        remaining, req.userId(), artistId);
            }
        }

        jdbc.update("UPDATE users SET cash = ? WHERE id = ?", newCash, req.userId());
        Long txId = jdbc.queryForObject("""
                INSERT INTO transactions (user_id, artist_id, side, shares, price, fee, game_date)
                VALUES (?, ?, ?, ?, ?, ?, (SELECT game_date FROM game_state WHERE id = 1)) RETURNING id""",
                Long.class, req.userId(), artistId, side, req.shares(), price, fee);

        return new TradeResult(txId, side, ticker, req.shares(), price, fee, newCash);
    }
}
