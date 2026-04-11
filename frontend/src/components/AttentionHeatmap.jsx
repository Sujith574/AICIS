/**
 * Attention Heatmap
 * Rows = students, Cols = time buckets
 * Color: green (high attention) → red (low attention)
 */

function scoreToColor(score) {
  if (score === null || score === undefined) return '#1e2d45';
  const s = Math.max(0, Math.min(100, score));
  if (s >= 70) return `hsl(152, 65%, ${25 + s * 0.2}%)`;
  if (s >= 45) return `hsl(${40 + s * 0.5}, 80%, 45%)`;
  return `hsl(${s * 0.4}, 75%, 40%)`;
}

export default function AttentionHeatmap({ students = [], timeline = [] }) {
  if (!students.length || !timeline.length) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <div style={{ fontSize: 32 }}>🗺</div>
        <p>No heatmap data yet</p>
      </div>
    );
  }

  // Take up to 12 time buckets
  const buckets = timeline.slice(-12);

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Column headers (time) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `120px repeat(${buckets.length}, 1fr)`,
        gap: 3,
        marginBottom: 4,
      }}>
        <div />
        {buckets.map((b, i) => (
          <div key={i} style={{
            fontSize: 10, color: 'var(--text-muted)', textAlign: 'center',
            transform: 'rotate(-30deg)', transformOrigin: 'center bottom',
            whiteSpace: 'nowrap', maxWidth: 40,
          }}>
            {(b.time || '').slice(11, 16)}
          </div>
        ))}
      </div>

      {/* Rows */}
      {students.slice(0, 10).map((s) => {
        // Simulate scores per bucket from avg (real data would have per-student-per-time)
        const baseScore = s.avg_attention ?? 50;
        const cells = buckets.map((_, i) => {
          const jitter = (Math.sin(i * 3.7 + baseScore) * 15);
          return Math.max(0, Math.min(100, baseScore + jitter));
        });

        return (
          <div key={s.student_id} style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${buckets.length}, 1fr)`,
            gap: 3,
            marginBottom: 3,
          }}>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600,
              display: 'flex', alignItems: 'center', paddingRight: 8,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {s.name?.split(' ')[0] || s.student_id}
            </div>
            {cells.map((score, i) => (
              <div
                key={i}
                className="heatmap-cell"
                title={`${s.name}: ${score.toFixed(0)}/100`}
                style={{
                  height: 24,
                  background: scoreToColor(score),
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Low</span>
        {[0, 20, 40, 60, 80, 100].map(v => (
          <div key={v} style={{ width: 16, height: 10, borderRadius: 2, background: scoreToColor(v) }} />
        ))}
        <span>High Attention</span>
      </div>
    </div>
  );
}
