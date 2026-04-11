export default function RiskPanel({ students = [] }) {
  const sorted = [...students].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2, Unknown: 3 };
    return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3);
  });

  const counts = {
    High:   students.filter(s => s.risk_level === 'High').length,
    Medium: students.filter(s => s.risk_level === 'Medium').length,
    Low:    students.filter(s => s.risk_level === 'Low').length,
  };

  return (
    <div className="card fade-in">
      <div className="card-header">
        <span className="card-title">⚠️ At-Risk Students</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="badge badge-high">{counts.High} High</span>
          <span className="badge badge-medium">{counts.Medium} Med</span>
          <span className="badge badge-low">{counts.Low} Low</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <p>All students on track!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {sorted.map(s => (
            <div key={s.student_id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${
                s.risk_level === 'High'   ? 'var(--risk-high)'   :
                s.risk_level === 'Medium' ? 'var(--risk-medium)' :
                                            'var(--risk-low)'
              }`,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.student_id} · Att: {s.attendance_pct}% · Focus: {s.avg_attention}/100
                </div>
              </div>
              <span className={`badge badge-${(s.risk_level || 'unknown').toLowerCase()}`}>
                {s.risk_level || '?'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
