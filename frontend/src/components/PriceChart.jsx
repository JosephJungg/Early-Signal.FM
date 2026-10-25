import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';

const BG = '#050505';
const RANGES = { '1 WEEK': 7, '2 WEEKS': 14, '1 MONTH': 30, ALL: Infinity };

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();

// Several trades on the same day and side become one marker at their average price.
function tradeMarkers(trades) {
  const groups = new Map();
  for (const t of trades) {
    const key = `${t.gameDate}|${t.side}`;
    const g = groups.get(key) ?? { date: t.gameDate, side: t.side, shares: 0, cost: 0 };
    g.shares += t.shares;
    g.cost += t.shares * Number(t.price);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => {
    const price = g.cost / g.shares;
    const buy = g.side === 'BUY';
    // Buys point up at the price from below, sells point down from above, so a same-day buy and sell don't overlap.
    return {
      time: g.date,
      position: buy ? 'atPriceBottom' : 'atPriceTop',
      price,
      shape: buy ? 'arrowUp' : 'arrowDown',
      color: buy ? '#d38bff' : '#e8e8e8',
      text: `${buy ? 'BOUGHT' : 'SOLD'} ${g.shares} @ ${price.toFixed(2)} · ${shortDate(g.date)}`,
      size: 1,
    };
  });
}

// Price line + listener bars, with the forecast cone drawn as two stacked areas:
// the upper band is filled, then the lower band is filled with the background to "cut out" the cone.
export default function PriceChart({ artist, showCone, range, avgCost, events, trades = [] }) {
  const forecast = artist.forecast;
  const el = useRef(null);
  const s = useRef(null);

  useEffect(() => {
    const chart = createChart(el.current, {
      autoSize: true,
      // Scrolling and zooming by accident is confusing for first-timers; use the range tabs instead.
      handleScroll: false,
      handleScale: false,
      layout: {
        background: { color: BG },
        textColor: '#a0a0a0',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 12,
        panes: { separatorColor: '#333', separatorHoverColor: '#333' },
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: '#161616' } },
      rightPriceScale: { borderColor: '#333' },
      timeScale: { borderColor: '#333', rightOffset: 1 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: '#ffa028', labelBackgroundColor: '#ffa028', style: LineStyle.Dashed },
        horzLine: { color: '#ffa028', labelBackgroundColor: '#ffa028', style: LineStyle.Dashed },
      },
    });
    const hidden = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
    const upper = chart.addSeries(AreaSeries, {
      ...hidden,
      lineColor: 'rgba(74,198,255,0.6)',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      topColor: 'rgba(74,198,255,0.18)',
      bottomColor: 'rgba(74,198,255,0.18)',
    });
    const lower = chart.addSeries(AreaSeries, {
      ...hidden,
      lineColor: 'rgba(74,198,255,0.6)',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      topColor: BG,
      bottomColor: BG,
    });
    const price = chart.addSeries(AreaSeries, {
      lineColor: '#ffa028',
      lineWidth: 2,
      topColor: 'rgba(255,160,40,0.22)',
      bottomColor: 'rgba(255,160,40,0.02)',
      priceLineColor: '#ffa028',
    });
    const mean = chart.addSeries(LineSeries, { ...hidden, color: '#4ac6ff', lineWidth: 2, lineStyle: LineStyle.Dotted });
    const listeners = chart.addSeries(HistogramSeries, { ...hidden, priceFormat: { type: 'volume' } }, 1);
    chart.panes()[1]?.setHeight(56);
    const markers = createSeriesMarkers(price, []);
    s.current = { chart, upper, lower, price, mean, listeners, markers, costLine: null };

    // Refit when the panel changes size (window resize, moving to the projector, layout breakpoints).
    // On short charts (smaller screens) the listener bars shrink so the price line keeps most of the room.
    const ro = new ResizeObserver(([entry]) =>
      requestAnimationFrame(() => {
        if (!s.current) return;
        const h = entry.contentRect.height;
        s.current.chart.panes()[1]?.setHeight(Math.round(Math.max(28, Math.min(56, h * 0.16))));
        s.current.chart.timeScale().fitContent();
      }),
    );
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.remove();
      s.current = null;
    };
  }, []);

  useEffect(() => {
    const c = s.current;
    if (!c) return;
    const hist = artist.history.slice(-Math.min(RANGES[range] ?? Infinity, artist.history.length));
    c.price.setData(hist.map((p) => ({ time: p.date, value: p.price })));
    // Listener bars: one muted color, tinted by whether listeners grew or shrank that day.
    c.listeners.setData(
      hist.map((p, i) => {
        const prev = hist[i - 1] ?? p;
        return {
          time: p.date,
          value: p.listeners,
          color: p.listeners >= prev.listeners ? 'rgba(51,224,139,0.28)' : 'rgba(255,90,82,0.28)',
        };
      }),
    );
    c.listeners.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });

    // Start the cone at today's price so it joins the price line.
    const last = hist[hist.length - 1];
    const cone =
      showCone && last && forecast.length
        ? [{ date: last.date, mean: last.price, lower: last.price, upper: last.price }, ...forecast]
        : [];
    c.upper.setData(cone.map((p) => ({ time: p.date, value: p.upper })));
    c.lower.setData(cone.map((p) => ({ time: p.date, value: p.lower })));
    c.mean.setData(cone.map((p) => ({ time: p.date, value: p.mean })));

    // News events as small arrows (details are in the News panel).
    const first = hist[0]?.date ?? '';
    const news = events
      .filter((e) => e.ticker === artist.ticker && e.date >= first)
      .map((e) => ({
        time: e.date,
        position: e.positive ? 'belowBar' : 'aboveBar',
        shape: e.positive ? 'arrowUp' : 'arrowDown',
        color: e.positive ? '#33e08b' : '#ff5a52',
        size: 1,
      }));
    // Your own trades as arrows at the exact price you got, labeled with shares and price.
    const mine = tradeMarkers(trades.filter((t) => t.ticker === artist.ticker && t.gameDate >= first));
    c.markers.setMarkers([...news, ...mine].sort((a, b) => a.time.localeCompare(b.time)));

    if (c.costLine) c.price.removePriceLine(c.costLine);
    c.costLine = avgCost
      ? c.price.createPriceLine({
          price: avgCost,
          color: '#d38bff',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'YOU PAID',
        })
      : null;

    c.chart.timeScale().fitContent();
  }, [artist, forecast, showCone, range, avgCost, events, trades]);

  return <div className="chart" ref={el} />;
}

export const CHART_RANGES = Object.keys(RANGES);
