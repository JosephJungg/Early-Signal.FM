// Client-side copy of the backend's trade rules (TradeService), used only to preview orders.
// The server is the source of truth and rejects anything invalid.
export const FEE_RATE = 0.01;
export const POSITION_CAP = 0.3;

const cents = (n) => Math.round(n * 100) / 100;

export function previewTrade({ side, qty, price, cash, totalValue, sharesHeld }) {
  const shares = Math.floor(Number(qty));
  const base = { side, price, qty: shares, sharesBefore: sharesHeld, weightBefore: (sharesHeld * price) / totalValue };
  if (!Number.isFinite(shares) || shares <= 0) return { ...base, ok: false, error: 'QUANTITY MUST BE > 0' };

  const notional = cents(shares * price);
  const fee = cents(notional * FEE_RATE);
  if (side === 'BUY') {
    const total = notional + fee;
    const sharesAfter = sharesHeld + shares;
    const valueAfter = totalValue - fee;
    const out = { ...base, notional, fee, total, cashAfter: cash - total, sharesAfter, weightAfter: (sharesAfter * price) / valueAfter };
    if (total > cash) return { ...out, ok: false, error: 'INSUFFICIENT CREDITS' };
    if (sharesAfter * price > POSITION_CAP * valueAfter) return { ...out, ok: false, error: `EXCEEDS ${POSITION_CAP * 100}% POSITION CAP` };
    return { ...out, ok: true };
  }
  const sharesAfter = sharesHeld - shares;
  const out = {
    ...base,
    notional,
    fee,
    total: notional - fee,
    cashAfter: cash + notional - fee,
    sharesAfter,
    weightAfter: (sharesAfter * price) / (totalValue - fee),
  };
  if (shares > sharesHeld) return { ...out, ok: false, error: `ONLY ${sharesHeld} SHS HELD` };
  return { ...out, ok: true };
}

export function maxBuy({ price, cash, totalValue, sharesHeld }) {
  const byCash = cash / (price * (1 + FEE_RATE));
  const byCap = (POSITION_CAP * totalValue - sharesHeld * price) / (price * (1 + POSITION_CAP * FEE_RATE));
  let q = Math.max(0, Math.floor(Math.min(byCash, byCap)));
  // Step down past any cent-rounding edge so the server never rejects a MAX order.
  while (q > 0 && !previewTrade({ side: 'BUY', qty: q, price, cash, totalValue, sharesHeld }).ok) q--;
  return q;
}
