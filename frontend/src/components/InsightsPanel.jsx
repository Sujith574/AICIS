export default function InsightsPanel({ insights = [] }) {
  const ICONS = ['💡', '📉', '🔴', '📈', '✅', '⚠️', '🎯', '📊'];

  return (
    <div className="card fade-in">
      <div className="card-header">
        <span className="card-title">🧠 Teacher Insights</span>
        <span className="badge badge-blue">Auto-generated</span>
      </div>

      {insights.length === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}>
          <div style={{ fontSize: 28 }}>🧠</div>
          <p>Insights appear after sessions run</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map((insight, i) => (
            <div key={i} className="insight-item" style={{
              borderLeftColor: i === 0 ? 'var(--accent-cyan)' :
                               i % 3 === 1 ? 'var(--accent-purple)' : 'var(--accent-blue)',
              animation: `fadeIn 0.3s ease ${i * 0.1}s both`,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[i % ICONS.length]}</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
