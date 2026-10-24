const KEYS = [
  { key: 'F1', label: 'HELP', color: 'k-green', action: 'help' },
  { key: 'F2', label: 'BUY', color: 'k-green', action: 'buy' },
  { key: 'F3', label: 'SELL', color: 'k-red', action: 'sell' },
  { key: 'F4', label: 'FCST', color: 'k-blue', action: 'fcst' },
  { key: 'F6', label: 'PORT', color: 'k-yellow', action: 'port' },
  { key: 'F7', label: 'LEADERS', color: 'k-yellow', action: 'leaders' },
  { key: 'F8', label: 'ADV DAY', color: 'k-amber', action: 'advance' },
];

export default function FKeyBar({ onAction, selected }) {
  return (
    <div className="fkeys">
      {KEYS.map((k) => (
        <button key={k.key} className="fkey" onClick={() => onAction(k.action)}>
          <span className={`keycap ${k.color}`}>{k.key}</span>
          {k.label}
        </button>
      ))}
      <span className="fkeys-spacer" />
      <span className="security">
        <b>{selected}</b> <span className="sec-hint">&lt;ARTIST&gt;</span>
      </span>
    </div>
  );
}
