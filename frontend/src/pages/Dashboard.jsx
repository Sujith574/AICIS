import { useEffect, useState } from 'react';
import { dashboardAPI, riskAPI } from '../api/client';
import EngagementChart from '../components/EngagementChart';
import AttentionHeatmap from '../components/AttentionHeatmap';
import RiskPanel from '../components/RiskPanel';
import InsightsPanel from '../components/InsightsPanel';
import toast from 'react-hot-toast';

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card fade-in">
      <div className="stat-icon" style={{ background: color + '22' }}>
        <span>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [dashRes, riskRes] = await Promise.all([
        dashboardAPI.data(),
        riskAPI.computeAll(),
      ]);
      setData(dashRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <p>Loading dashboard…</p>
    </div>
  );

  if (!data) return (
    <div className="empty-state">
      <div className="empty-state-icon">📊</div>
      <h3>No data yet</h3>
      <p>Register students and run a session to see insights.</p>
    </div>
  );

  const riskColor = count => count === 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 className="section-title">📊 Dashboard Overview</h2>
        <button className="btn btn-outline btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard icon="👥" label="Total Students"    value={data.total_students}  color="#3b82f6" sub="Registered" />
        <StatCard icon="📅" label="Total Sessions"    value={data.total_sessions}  color="#8b5cf6" sub="Conducted" />
        <StatCard icon="🎯" label="Avg Attention"     value={`${data.class_avg_attention}%`} color="#06b6d4" sub="Class average" />
        <StatCard icon="✅" label="Avg Attendance"    value={`${data.class_avg_attendance}%`} color="#10b981" sub="Class average" />
        <StatCard icon="⚠️" label="At-Risk Students"  value={data.at_risk_count}
          color={data.at_risk_count > 0 ? '#ef4444' : '#10b981'} sub="High risk" />
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Engagement Timeline</span>
          </div>
          <EngagementChart data={data.engagement_timeline} />
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🗺  Attention Heatmap</span>
          </div>
          <AttentionHeatmap students={data.students} timeline={data.engagement_timeline} />
        </div>
      </div>

      {/* Risk + Insights */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <RiskPanel students={data.students} />
        <InsightsPanel insights={data.insights} />
      </div>

      {/* Full attendance summary table */}
      <div className="card fade-in">
        <div className="card-header">
          <span className="card-title">📋 Student Summary</span>
          <span className="badge badge-blue">{data.students.length} students</span>
        </div>
        {data.students.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">👥</div>
            <h3>No students registered</h3>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Attendance</th>
                  <th>Avg Attention</th><th>Sessions</th><th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(s => (
                  <tr key={s.student_id}>
                    <td><span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.student_id}</span></td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${s.attendance_pct}%`,
                              background: s.attendance_pct >= 75
                                ? 'var(--accent-green)'
                                : s.attendance_pct >= 50
                                  ? 'var(--accent-yellow)'
                                  : 'var(--accent-red)',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 13 }}>{s.attendance_pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={
                        s.avg_attention >= 70 ? 'attention-high'
                        : s.avg_attention >= 45 ? 'attention-medium'
                        : 'attention-low'
                      } style={{ fontWeight: 700 }}>
                        {s.avg_attention}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/100</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.sessions_count}</td>
                    <td>
                      <span className={`badge badge-${(s.risk_level || 'unknown').toLowerCase()}`}>
                        {s.risk_level || '–'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
