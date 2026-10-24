// Bordered terminal window with a code + title strip and optional numbered tabs.
export default function Panel({ area, code, title, right, tabs, activeTab, onTab, children }) {
  return (
    <section className={`panel ${area ?? ''}`}>
      <header className="panel-head">
        {code && <span className="panel-code">{code}</span>}
        <span className="panel-title">{title}</span>
        {right && <span className="panel-right">{right}</span>}
      </header>
      {tabs && (
        <nav className="panel-tabs">
          {tabs.map((t, i) => (
            <button key={t} className={t === activeTab ? 'on' : ''} onClick={() => onTab?.(t)}>
              <span className="tab-num">{i + 1})</span> {t}
            </button>
          ))}
        </nav>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
