// "How to play": shown automatically the first time, and any time with F1 or HELP.
const STEPS = [
  ['Artists are stocks', 'Every artist has a share price that follows their streaming numbers. More listeners, higher price.'],
  ['Buy who you believe in', 'You start with 10,000 credits. Pick an artist, choose how many shares, and buy. Each trade costs a 1% fee, and no artist can be more than 30% of your money.'],
  ['Advance the day', 'Press ADVANCE DAY. Prices move, news hits (viral spikes, scandals, tours), and you get a summary of what happened to your money.'],
  ['Check the forecast', 'The blue cone on the chart is our model’s guess for the next 7 days. A narrow cone means it’s confident; a wide one means anything could happen.'],
  ['Climb the leaderboard', 'Grow your net worth to beat the other players, and the AI bot trading on the same forecasts.'],
];

const KEYS = [
  ['F2 / F3', 'Buy / sell the selected artist'],
  ['F8', 'Advance one day'],
  ['F4', 'Show or hide the forecast'],
  ['↑ ↓', 'Move through the artist list'],
  ['/', 'Jump to the command box'],
  ['ESC', 'Close windows'],
];

const COMMANDS = [
  ['BUY LUNA 10', 'Buy 10 shares of LUNA'],
  ['BUY LUNA MAX', 'Buy as many as you can'],
  ['SELL KAI ALL', 'Sell all your KAI'],
  ['FCST LUNA', 'Show LUNA’s forecast'],
  ['NEXT', 'Advance one day'],
];

export default function Guide({ onClose, firstTime }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-title" id="guide-title">{firstTime ? 'WELCOME · HOW TO PLAY' : 'HOW TO PLAY'}</span>
          <span className="panel-right">ESC TO CLOSE</span>
        </div>
        <div className="guide-body">
          <ol className="steps">
            {STEPS.map(([h, p]) => (
              <li key={h}>
                <div>
                  <h5>{h}</h5>
                  <p>{p}</p>
                </div>
              </li>
            ))}
          </ol>
          <div>
            <h4>SHORTCUTS</h4>
            {KEYS.map(([k, d]) => (
              <div key={k} className="guide-row"><b><span className="keycap">{k}</span></b><span>{d}</span></div>
            ))}
            <h4 style={{ marginTop: 18 }}>OR TYPE A COMMAND</h4>
            {COMMANDS.map(([c, d]) => (
              <div key={c} className="guide-row"><b>{c}</b><span>{d}</span></div>
            ))}
          </div>
        </div>
        <div className="guide-cta">
          <button onClick={onClose} autoFocus>{firstTime ? 'START TRADING ▶' : 'BACK TO THE GAME'}</button>
        </div>
      </div>
    </div>
  );
}
