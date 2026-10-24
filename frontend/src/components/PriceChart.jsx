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

const BG = '#000000';
const RANGES = { '1W': 7, '2W': 14, '1M': 30, ALL: Infinity };

// Price line + listener bars, with the GPR forecast cone drawn as two stacked areas:
// the upper band is filled, then the lower band is filled with the background to "cut out" the cone.
export default function PriceChart({ artist, fc, showCone, range, avgCost, events }) {
  const el = useRef(null);
  const s = useRef(null);

  useEffect(() => {
    const chart = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { color: BG },
        textColor: '#8c8c8c',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        panes: { separatorColor: '#262626', separatorHoverColor: '#3a3a3a' },
        attributionLogo: false,
      },
      grid: { vertLines: { color: '#101010' }, horzLines: { color: '#141414' } },
      rightPriceScale: { borderColor: '#262626' },
      timeScale: { borderColor: '#262626', rightOffset: 2 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#ffa028', labelBackgroundColor: '#ffa028', style: LineStyle.Dashed },
        horzLine: { color: '#ffa028', labelBackgroundColor: '#ffa028', style: LineStyle.Dashed },
      },
    });
    const hidden = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
    const upper = chart.addSeries(AreaSeries, {
      ...hidden,
      lineColor: 'rgba(74,198,255,0.7)',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      topColor: 'rgba(74,198,255,0.20)',
      bottomColor: 'rgba(74,198,255,0.20)',
    });
    const lower = chart.addSeries(AreaSeries, {
      ...hidden,
      lineColor: 'rgba(74,198,255,0.7)',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      topColor: BG,
      bottomColor: BG,
    });
    const price = chart.addSeries(AreaSeries, {
      lineColor: '#ffa028',
      lineWidth: 2,
      topColor: 'rgba(255,160,40,0.28)',
      bottomColor: 'rgba(255,160,40,0.02)',
      priceLineColor: '#ffa028',
    });
    const mean = chart.addSeries(LineSeries, {
      ...hidden,
      color: '#4ac6ff',
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
    });
    const listeners = chart.addSeries(
      HistogramSeries,
      { ...hidden, priceFormat: { type: 'volume' } },
      1,
    );
    chart.panes()[1]?.setHeight(80);
    const markers = createSeriesMarkers(price, []);
    s.current = { chart, upper, lower, price, mean, listeners, markers, costLine: null };
    return () => chart.remove();
  }, []);

  useEffect(() => {
    const c = s.current;
    if (!c) return;
    const hist = artist.history.slice(-Math.min(RANGES[range], artist.history.length));
    c.price.setData(hist.map((p) => ({ time: p.date, value: p.price })));
    c.listeners.setData(
      hist.map((p, i) => {
        const prev = hist[i - 1] ?? p;
        return {
          time: p.date,
          value: p.listeners,
          color: p.price >= prev.price ? 'rgba(34,224,122,0.55)' : 'rgba(255,77,77,0.55)',
        };
      }),
    );

    const cone = showCone ? fc.points : [];
    c.upper.setData(cone.map((p) => ({ time: p.date, value: p.upper })));
    c.lower.setData(cone.map((p) => ({ time: p.date, value: p.lower })));
    c.mean.setData(cone.map((p) => ({ time: p.date, value: p.mean })));

    const first = hist[0]?.day ?? 0;
    c.markers.setMarkers(
      events
        .filter((e) => e.ticker === artist.ticker && e.day >= first)
        .sort((a, b) => a.day - b.day)
        .map((e) => ({
          time: e.date,
          position: e.impactPct >= 0 ? 'belowBar' : 'aboveBar',
          shape: e.impactPct >= 0 ? 'arrowUp' : 'arrowDown',
          color: e.impactPct >= 0 ? '#22e07a' : '#ff4d4d',
          text: e.type,
        })),
    );

    if (c.costLine) c.price.removePriceLine(c.costLine);
    c.costLine = avgCost
      ? c.price.createPriceLine({
          price: avgCost,
          color: '#d66bff',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'AVG COST',
        })
      : null;

    c.chart.timeScale().fitContent();
  }, [artist, fc, showCone, range, avgCost, events]);

  return <div className="chart" ref={el} />;
}
