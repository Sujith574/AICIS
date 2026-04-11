import { useState, useEffect, useRef } from 'react';
import { attendanceAPI, engagementAPI } from '../api/client';
import { sessionsAPI } from '../api/client';
import WebcamCapture from '../components/WebcamCapture';
import EngagementChart from '../components/EngagementChart';
import { WS_BASE } from '../api/client';
import toast from 'react-hot-toast';

export default function Session() {
  const [subject,     setSubject]     = useState('');
  const [session,     setSession]     = useState(null);
  const [active,      setActive]      = useState(false);
  const [events,      setEvents]      = useState([]);
  const [liveData,    setLiveData]    = useState([]);
  const [frameCount,  setFrameCount]  = useState(0);
  const webcamRef = useRef(null);
  const wsRef     = useRef(null);
  const intervalRef = useRef(null);

  const startSession = async () => {
    if (!subject.trim()) return toast.error('Enter a subject');
    try {
      const { data } = await sessionsAPI.create(subject);
      setSession(data);
      setActive(true);
      setEvents([]);
      setLiveData([]);
      toast.success(`Session started: ${data.session_id.slice(0, 8)}…`);

      // Connect WebSocket
      const ws = new WebSocket(`${WS_BASE}/ws/live-session/${data.session_id}`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.student_id) {
            setEvents(prev => {
              const exists = prev.find(e => e.student_id === msg.student_id);
              if (exists) {
                return prev.map(e => e.student_id === msg.student_id
                  ? { ...e, attention_score: msg.engagement?.attention_score ?? e.attention_score }
                  : e
                );
              }
              return [{
                student_id:    msg.student_id,
                attention_score: msg.engagement?.attention_score ?? 0,
                confidence:    msg.confidence,
                marked_at:     msg.timestamp,
              }, ...prev];
            });
            setLiveData(prev => [
              ...prev.slice(-30),
              { time: new Date().toLocaleTimeString(), avg_attention: msg.engagement?.attention_score ?? 50 },
            ]);
          }
        } catch {}
      };

      ws.onerror = () => toast.error('WebSocket error');

      // Send frames every 2s
      intervalRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const frame = webcamRef.current?.captureFrame();
        if (frame) {
          ws.send(JSON.stringify({ frame_b64: frame }));
          setFrameCount(c => c + 1);
        }
      }, 2000);

    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start session');
    }
  };

  const endSession = async () => {
    clearInterval(intervalRef.current);
    wsRef.current?.close();
    if (session) {
      try {
        await sessionsAPI.end(session.session_id);
        toast.success('Session ended');
      } catch {}
    }
    setActive(false);
    setSession(null);
  };

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    wsRef.current?.close();
  }, []);

  return (
    <div className="page-content">
      <h2 className="section-title">🎥 Live Session</h2>

      {/* Session Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Subject</label>
            <input
              className="form-input"
              placeholder="e.g. Mathematics 101"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={active}
            />
          </div>
          {!active ? (
            <button className="btn btn-success" onClick={startSession}>
              ▶ Start Session
            </button>
          ) : (
            <button className="btn btn-danger" onClick={endSession}>
              ⏹ End Session
            </button>
          )}
        </div>

        {active && session && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="live-dot" /> LIVE
            </span>
            <span className="badge badge-blue">Session: {session.session_id.slice(0,8)}…</span>
            <span className="badge badge-blue">{session.subject}</span>
            <span className="text-muted">Frames: {frameCount}</span>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Webcam */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📷 Webcam Feed</span>
            {active && <span className="badge badge-high">Recording</span>}
          </div>
          <WebcamCapture ref={webcamRef} active={active} />
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            Frames are processed every 2 seconds via WebSocket for face recognition and engagement analysis.
          </div>
        </div>

        {/* Live Attendance Log */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">✅ Live Attendance</span>
            <span className="badge badge-blue">{events.length} detected</span>
          </div>
          {events.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div style={{ fontSize: 32 }}>👥</div>
              <p>Faces will appear here as they're detected</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {events.map((e) => (
                <div key={e.student_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--accent-green)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{e.student_id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Confidence: {(e.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: 700, fontSize: 16,
                      color: e.attention_score >= 70 ? 'var(--accent-green)'
                           : e.attention_score >= 45 ? 'var(--accent-yellow)'
                           : 'var(--accent-red)',
                    }}>
                      {(e.attention_score || 0).toFixed(0)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>attention</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Chart */}
      {active && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">📈 Real-time Engagement</span>
          </div>
          <EngagementChart data={liveData} />
        </div>
      )}
    </div>
  );
}
