import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/*
 * Guided tour: dims the screen, spotlights one part of the terminal per step, and explains it.
 * Each step lists target selectors in order of preference; the first one that's visible wins
 * (smaller screens move News and the Leaderboard into portfolio tabs). Steps with no visible
 * target are skipped. A step without `targets` is a centered card.
 */
const STEPS = [
  {
    title: 'Welcome to early-signal.fm',
    body: 'Trade music artists like stocks. This quick tour shows you what each part of the screen does. It takes about a minute.',
  },
  {
    targets: [{ sel: '.area-market' }],
    title: 'Artists are stocks',
    body: 'Every row is an artist with a share price that follows their streaming numbers: more listeners, higher price. TODAY is the move since yesterday, and OUTLOOK is what the forecast model expects. Click any row to load that artist everywhere.',
  },
  {
    targets: [{ sel: '.area-chart' }],
    title: 'The price chart',
    body: 'The orange line is the selected artist’s price. The bars underneath are monthly listeners, and the small arrows mark news. The blue cone is the forecast: the likely range for the next 7 days. Narrow means confident, wide means anything could happen.',
  },
  {
    targets: [{ sel: '.area-fcst' }],
    title: 'The forecast, in plain words',
    body: 'The model’s guess spelled out: BUY, HOLD or SELL, where the price should be in 7 days, and a day-by-day table with the low and high ends of the range.',
  },
  {
    targets: [{ sel: '.area-trade' }],
    title: 'Buy who you believe in',
    body: 'Choose how many shares and press BUY. You’ll see the cost, the 1% fee, and how much of your money it would be. No single artist can be more than 30% of your net worth, so spread your bets.',
  },
  {
    targets: [{ sel: '.area-port' }],
    title: 'Your portfolio',
    body: 'Your net worth is your cash plus what your shares are worth right now. Every artist you own shows up here with its profit or loss.',
  },
  {
    targets: [{ sel: '.adv' }],
    title: 'Advance the day',
    body: 'This moves the game forward one day. Prices move, news hits, and you get a summary of exactly what happened to your money.',
  },
  {
    targets: [
      { sel: '.area-news' },
      {
        sel: '.area-port .panel-tabs',
        body: 'On this screen size, the News and the Leaderboard are tabs right here. News is what moves prices: viral spikes, tours, scandals.',
      },
    ],
    title: 'The news',
    body: 'Events that move prices: viral spikes, playlist adds, tours, scandals. The newest ones are highlighted. Click one to jump to that artist.',
  },
  {
    targets: [{ sel: '.area-lead' }],
    title: 'Climb the leaderboard',
    body: 'Everyone starts with 10,000 credits. Beat the other players, and the AI bot that trades on the same forecasts you see.',
  },
  {
    targets: [{ sel: '.cmd' }],
    title: 'Shortcuts, if you want them',
    body: 'Prefer typing? Try BUY NETT 10, SELL NETT ALL or NEXT here. Keys: F2 buy, F3 sell, F4 forecast on/off, F8 next day. Press F1 any time to see this tour again.',
  },
];

const PAD = 6;
const GAP = 14;
const MARGIN = 12;

const visible = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

function resolveSteps() {
  return STEPS.flatMap((s) => {
    if (!s.targets) return [s];
    const hit = s.targets.find((t) => visible(document.querySelector(t.sel)));
    return hit ? [{ ...s, sel: hit.sel, body: hit.body ?? s.body }] : [];
  });
}

// Put the card beside the spotlight: small targets prefer below, big panels prefer the side.
function placeCard(rect, card, vw, vh) {
  if (!rect) return { left: (vw - card.w) / 2, top: (vh - card.h) / 2 };
  const room = {
    right: vw - rect.right - GAP >= card.w + MARGIN,
    left: rect.left - GAP >= card.w + MARGIN,
    below: vh - rect.bottom - GAP >= card.h + MARGIN,
    above: rect.top - GAP >= card.h + MARGIN,
  };
  const small = rect.height < 120;
  const order = small ? ['below', 'left', 'right', 'above'] : ['right', 'left', 'below', 'above'];
  const side = order.find((o) => room[o]);
  const centerX = rect.left + rect.width / 2 - card.w / 2;
  let left;
  let top;
  if (side === 'right') [left, top] = [rect.right + GAP, rect.top];
  else if (side === 'left') [left, top] = [rect.left - GAP - card.w, rect.top];
  else if (side === 'below') [left, top] = [centerX, rect.bottom + GAP];
  else if (side === 'above') [left, top] = [centerX, rect.top - GAP - card.h];
  else [left, top] = [centerX, rect.bottom - card.h - MARGIN]; // no room outside: sit inside the bottom of the target
  return {
    left: Math.max(MARGIN, Math.min(left, vw - card.w - MARGIN)),
    top: Math.max(MARGIN, Math.min(top, vh - card.h - MARGIN)),
  };
}

export default function Tour({ firstTime, onClose }) {
  const steps = useMemo(resolveSteps, []);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const [tick, setTick] = useState(0);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  // Measure the target (scrolling it into view on stacked layouts), and re-measure on resize/scroll.
  useLayoutEffect(() => {
    if (!step.sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.sel);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  }, [step, tick]);

  useLayoutEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    setPos(placeCard(rect, { w: c.offsetWidth, h: c.offsetHeight }, window.innerWidth, window.innerHeight));
  }, [rect, step]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('resize', bump);
    window.addEventListener('scroll', bump, true);
    return () => {
      window.removeEventListener('resize', bump);
      window.removeEventListener('scroll', bump, true);
    };
  }, []);

  // Focus Next once the card is placed (a hidden card can't take focus), so Enter moves on.
  useEffect(() => {
    if (pos) nextRef.current?.focus();
  }, [i, pos]);

  const next = () => (last ? onClose() : setI((n) => n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    const onKey = (e) => {
      const onButton = document.activeElement?.tagName === 'BUTTON';
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !onButton)) {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const spot = rect && {
    top: Math.max(2, rect.top - PAD),
    left: Math.max(2, rect.left - PAD),
    width: Math.min(rect.width + PAD * 2, window.innerWidth - 4),
    height: Math.min(rect.height + PAD * 2, window.innerHeight - 4),
  };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-block" />
      {spot ? <div className="tour-spot" style={spot} /> : <div className="tour-dim" />}
      <div
        ref={cardRef}
        className={`tour-card ${spot ? '' : 'centered'}`}
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      >
        <div className="tour-count">
          {i === 0 && firstTime ? 'WELCOME' : `STEP ${i + 1} OF ${steps.length}`}
          <button className="tour-skip" onClick={onClose}>
            {i === 0 ? 'Skip' : 'Skip tour'}
          </button>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {steps.map((s, n) => (
              <i key={s.title} className={n === i ? 'on' : n < i ? 'done' : ''} />
            ))}
          </div>
          {i > 0 && (
            <button className="tour-back" onClick={back}>
              ← Back
            </button>
          )}
          <button ref={nextRef} className="tour-next" onClick={next}>
            {i === 0 ? 'Show me ▶' : last ? 'Start trading ▶' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
