import { useState, useEffect } from 'react';
import { attendanceAPI, sessionsAPI } from '../api/client';
import toast from 'react-hot-toast';

export default function Attendance() {
  const [sessions,    setSessions]    = useState([]);
  const [records,     setRecords]     = useState([]);
  const [sessionId,   setSessionId]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [exporting,   setExporting]   = useState(false);

  useEffect(() => {
    sessionsAPI.list().then(r => setSessions(r.data)).catch(() => {});
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (sessionId) params.session_id = sessionId;
      const { data } = await attendanceAPI.list(params);
      setRecords(data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, [sessionId]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await attendanceAPI.exportCsv(sessionId || undefined);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `attendance_${sessionId || 'all'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const presentCount = records.filter(r => r.status === 'present').length;

  return (
    <div className="page-content">
      <h2 className="section-title">✅ Attendance Records</h2>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
            <label className="form-label">Filter by Session</label>
            <select
              className="form-input"
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
            >
              <option value="">All Sessions</option>
              {sessions.map(s => (
                <option key={s.session_id} value={s.session_id}>
                  {s.subject} — {new Date(s.started_at).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-outline" onClick={loadRecords} disabled={loading}>
            🔄 Refresh
          </button>
          <button className="btn btn-primary" onClick={exportCsv} disabled={exporting}>
            {exporting ? '⏳…' : '📥 Export CSV'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value">{records.length}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{presentCount}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{records.length - presentCount}</div>
          <div className="stat-label">Absent / Other</div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Attendance Log</span>
          <span className="badge badge-blue">{records.length} records</span>
        </div>
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No records found</h3>
            <p>Start a live session to mark attendance</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student ID</th><th>Name</th><th>Session</th>
                  <th>Timestamp</th><th>Status</th><th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td><span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.student_id}</span></td>
                    <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                    <td><span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.session_id?.slice(0, 8)}…</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(r.timestamp).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${r.status === 'present' ? 'badge-low' : 'badge-high'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-fill" style={{
                            width: `${(r.confidence * 100).toFixed(0)}%`,
                            background: 'var(--gradient-cyan)',
                          }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{(r.confidence * 100).toFixed(0)}%</span>
                      </div>
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
