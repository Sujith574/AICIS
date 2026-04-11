import { useState, useEffect } from 'react';
import { riskAPI } from '../api/client';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Risk() {
  const [risks,       setRisks]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [computing,   setComputing]   = useState(false);

  const loadRisks = async () => {
    setLoading(true);
    try {
      const { data } = await riskAPI.all();
      setRisks(data);
    } catch {
      toast.error('Failed to load risk data');
    } finally {
      setLoading(false);
    }
  };

  const computeAll = async () => {
    setComputing(true);
    try {
      await riskAPI.computeAll();
      toast.success('Risk levels updated!');
      loadRisks();
    } catch {
      toast.error('Failed to compute risk');
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => { loadRisks(); }, []);

  const sorted = [...risks].sort((a, b) => {
    const o = { High: 0, Medium: 1, Low: 2 };
    return (o[a.risk_level] ?? 3) - (o[b.risk_level] ?? 3);
  });

  const counts = {
    High:   risks.filter(r => r.risk_level === 'High').length,
    Medium: risks.filter(r => r.risk_level === 'Medium').length,
    Low:    risks.filter(r => r.risk_level === 'Low').length,
  };

  const barData = {
    labels: sorted.map(r => r.student_name?.split(' ')[0] || r.student_id),
    datasets: [
      {
        label: 'Attendance %',
        data: sorted.map(r => r.attendance_pct),
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderRadius: 4,
      },
      {
        label: 'Avg Attention',
        data: sorted.map(r => r.avg_attention),
        backgroundColor: 'rgba(6,182,212,0.7)',
        borderRadius: 4,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#8899bb' } },
      tooltip: { backgroundColor: '#1a2235', borderColor: '#1e2d45', borderWidth: 1 },
    },
    scales: {
      x: { grid: { color: 'rgba(30,45,69,0.6)' }, ticks: { color: '#8899bb' } },
      y: { min: 0, max: 100, grid: { color: 'rgba(30,45,69,0.6)' }, ticks: { color: '#8899bb' } },
    },
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 className="section-title">⚠️ Risk Report</h2>
        <button className="btn btn-primary" onClick={computeAll} disabled={computing}>
          {computing ? '⏳ Computing…' : '🔄 Recompute All'}
        </button>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ borderTop: '3px solid var(--risk-high)' }}>
          <div className="stat-value" style={{ color: 'var(--risk-high)' }}>{counts.High}</div>
          <div className="stat-label">High Risk</div>
          <div className="stat-sub">Immediate attention needed</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--risk-medium)' }}>
          <div className="stat-value" style={{ color: 'var(--risk-medium)' }}>{counts.Medium}</div>
          <div className="stat-label">Medium Risk</div>
          <div className="stat-sub">Monitor closely</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--risk-low)' }}>
          <div className="stat-value" style={{ color: 'var(--risk-low)' }}>{counts.Low}</div>
          <div className="stat-label">Low Risk</div>
          <div className="stat-sub">Performing well</div>
        </div>
      </div>

      {/* Bar Chart */}
      {risks.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">📊 Attendance & Attention by Student</span>
          </div>
          <div style={{ height: 240 }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Student Risk Details</span>
          <span className="badge badge-blue">{risks.length} students</span>
        </div>
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <h3>No risk data</h3>
            <p>Click <b>Recompute All</b> to run the ML model</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>ID</th><th>Risk Level</th>
                  <th>Attendance</th><th>Avg Attention</th>
                  <th>Confidence</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.student_id}>
                    <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                    <td><span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.student_id}</span></td>
                    <td><span className={`badge badge-${r.risk_level.toLowerCase()}`}>{r.risk_level}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 70 }}>
                          <div className="progress-fill" style={{
                            width: `${r.attendance_pct}%`,
                            background: r.attendance_pct >= 75 ? 'var(--accent-green)'
                              : r.attendance_pct >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                          }} />
                        </div>
                        <span style={{ fontSize: 13 }}>{r.attendance_pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={
                        r.avg_attention >= 70 ? 'attention-high'
                        : r.avg_attention >= 45 ? 'attention-medium' : 'attention-low'
                      } style={{ fontWeight: 700 }}>
                        {r.avg_attention}
                      </span>/100
                    </td>
                    <td style={{ fontSize: 13 }}>{(r.risk_probability * 100).toFixed(0)}%</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.computed_at ? new Date(r.computed_at).toLocaleString() : '–'}
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
