const COMMANDS = [
  ['BUY LUNA 10', 'Buy 10 shares of LUNA'],
  ['BUY LUNA MAX', 'Buy as many as cash and the 30% cap allow'],
  ['SELL KAI ALL', 'Sell your whole KAI position'],
  ['FCST LUNA', 'Select LUNA and show its forecast cone'],
  ['LUNA', 'Load an artist'],
  ['NEXT  /  ADV', 'Advance one day'],
  ['HELP', 'Show this screen'],
];

const KEYS = [
  ['F1', 'Help'],
  ['F2 / F3', 'Buy / sell ticket'],
  ['F4', 'Toggle forecast cone'],
  ['F6 / F7', 'Portfolio / leaderboard tabs'],
  ['F8', 'Advance day'],
  ['↑ ↓', 'Move through the market'],
  ['/', 'Jump to command line'],
  ['ESC', 'Close'],
];

export default function HelpOverlay({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="help" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-code">HELP</span>
          <span className="panel-title">EARLYSIGNAL TERMINAL — COMMANDS</span>
          <span className="panel-right">ESC CLOSE</span>
        </div>
        <div className="help-body">
          <div>
            <h4>COMMAND LINE</h4>
            {COMMANDS.map(([c, d]) => (
              <div key={c} className="help-row"><b>{c}</b><span>{d}</span></div>
            ))}
          </div>
          <div>
            <h4>KEYS</h4>
            {KEYS.map(([k, d]) => (
              <div key={k} className="help-row"><b>{k}</b><span>{d}</span></div>
            ))}
            <h4>RULES</h4>
            <p>10,000 starting credits · 1% fee on every trade · no single artist above 30% of net worth.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
