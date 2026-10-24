const KEYS = [
  { key: 'F1', label: 'How to play', action: 'help' },
  { key: 'F2', label: 'Buy', action: 'buy', cls: 'buy' },
  { key: 'F3', label: 'Sell', action: 'sell', cls: 'sell' },
  { key: 'F4', label: 'Forecast on/off', action: 'fcst' },
  { key: 'F8', label: 'Advance day', action: 'advance' },
  { key: '↑↓', label: 'Pick artist', action: null },
  { key: '/', label: 'Type a command', action: 'cmd' },
];

export default function FKeyBar({ onAction }) {
  return (
    <div className="fkeys">
      {KEYS.map((k) => (
        <button key={k.key} className="fkey" onClick={() => k.action && onAction(k.action)} tabIndex={k.action ? 0 : -1}>
          <span className={`keycap ${k.cls ?? ''}`}>{k.key}</span>
          {k.label}
        </button>
      ))}
    </div>
  );
}
