// Bordered terminal window: amber title, a short plain-language hint, optional tabs.
export default function Panel({ area, title, hint, right, tabs, activeTab, onTab, children }) {
  return (
    <section className={`panel ${area ?? ''}`}>
      <header className="panel-head">
        <span className="panel-title">{title}</span>
        {hint && <span className="panel-hint">{hint}</span>}
        {right && <span className="panel-right">{right}</span>}
      </header>
      {tabs && (
        <nav className="panel-tabs">
          {tabs.map((t) => (
            <button key={t} className={t === activeTab ? 'on' : ''} onClick={() => onTab?.(t)}>
              {t}
            </button>
          ))}
        </nav>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
