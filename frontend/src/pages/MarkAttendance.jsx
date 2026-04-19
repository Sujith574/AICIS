import { useState, useRef, useCallback, useEffect } from 'react';
import { attendanceAPI, sessionsAPI, studentsAPI } from '../api/client';
import toast from 'react-hot-toast';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function StatusBadge({ result }) {
  if (!result) return null;
  const cfg = {
    marked:         { icon: '✅', text: 'Attendance Marked!',   bg: '#10b98120', border: '#10b981', color: '#10b981' },
    already_marked: { icon: '🔁', text: 'Already Marked',       bg: '#f59e0b20', border: '#f59e0b', color: '#f59e0b' },
    no_face_detected:{ icon: '❓', text: 'No Face Detected',    bg: '#ef444420', border: '#ef4444', color: '#ef4444' },
    error:          { icon: '❌', text: 'Error',                 bg: '#ef444420', border: '#ef4444', color: '#ef4444' },
  };
  const c = cfg[result.status] || cfg.error;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
      marginTop: 12, animation: 'fadeIn 0.3s ease',
    }}>
      <span style={{ fontSize: 28 }}>{c.icon}</span>
      <div>
        <div style={{ fontWeight: 700, color: c.color, fontSize: 16 }}>{c.text}</div>
        {result.student_id && (
          <div style={{ fontSize: 13, color: '#8899bb', marginTop: 2 }}>
            Student: <strong style={{ color: '#f0f4ff' }}>{result.student_name || result.student_id}</strong>
            {result.confidence != null && ` · Confidence: ${(result.confidence * 100).toFixed(0)}%`}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */
export default function MarkAttendance() {
  const [phase,         setPhase]         = useState('setup');   // setup | session | done
  const [subject,       setSubject]       = useState('');
  const [session,       setSession]       = useState(null);
  const [capturing,     setCapturing]     = useState(false);
  const [lastResult,    setLastResult]    = useState(null);
  const [markedList,    setMarkedList]    = useState([]);   // [{student_id, name, time}]
  const [students,      setStudents]      = useState([]);   // registered students
  const [cameraReady,   setCameraReady]   = useState(false);
  const [startLoading,  setStartLoading]  = useState(false);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Load registered students for reference
  useEffect(() => {
    studentsAPI.list().then(r => setStudents(r.data)).catch(() => {});
  }, []);

  /* camera ----------------------------------------------------------------- */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (err) {
      toast.error('Camera access denied. Please allow camera permission.');
      setCameraReady(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), []);

  /* capture frame ---------------------------------------------------------- */
  const captureFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  /* start session ---------------------------------------------------------- */
  const startSession = async () => {
    if (!subject.trim()) return toast.error('Enter a subject name');
    setStartLoading(true);
    try {
      const { data } = await sessionsAPI.create(subject.trim());
      setSession(data);
      setPhase('session');
      setMarkedList([]);
      setLastResult(null);
      await startCamera();
      toast.success(`Session started: ${data.subject}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start session');
    } finally {
      setStartLoading(false);
    }
  };

  /* snap & mark one student ------------------------------------------------ */
  const snapAndMark = async () => {
    if (!cameraReady) return toast.error('Camera not ready');
    if (capturing) return;
    setCapturing(true);
    setLastResult(null);

    const frame = captureFrame();
    if (!frame) {
      setCapturing(false);
      return toast.error('Failed to capture frame');
    }

    // Flash effect
    if (videoRef.current) {
      videoRef.current.style.filter = 'brightness(3)';
      setTimeout(() => { if (videoRef.current) videoRef.current.style.filter = ''; }, 150);
    }

    try {
      const { data } = await attendanceAPI.markPhoto(session.session_id, frame);

      // Enrich result with student name
      let studentName = data.student_id;
      if (data.student_id) {
        const found = students.find(s => s.student_id === data.student_id);
        studentName = found ? found.name : data.student_id;
      }

      const result = { ...data, student_name: studentName };
      setLastResult(result);

      if (data.status === 'marked') {
        const entry = { student_id: data.student_id, name: studentName, time: new Date().toLocaleTimeString(), confidence: data.confidence };
        setMarkedList(prev => {
          const exists = prev.find(e => e.student_id === data.student_id);
          return exists ? prev : [entry, ...prev];
        });
        toast.success(`✅ Marked: ${studentName}`);
      } else if (data.status === 'already_marked') {
        toast('🔁 Already marked for this session', { icon: '🔁' });
      } else {
        toast.error('No face detected — try again');
      }
    } catch (err) {
      setLastResult({ status: 'error' });
      toast.error(err.response?.data?.detail || 'Mark failed');
    } finally {
      setCapturing(false);
    }
  };

  /* end session ------------------------------------------------------------ */
  const endSession = async () => {
    stopCamera();
    try {
      await sessionsAPI.end(session.session_id);
    } catch {}
    setPhase('done');
    toast.success(`Session ended · ${markedList.length} student(s) marked`);
  };

  /* marked badge (is student in list?) ------------------------------------- */
  const isMarked = id => markedList.some(m => m.student_id === id);

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="page-content">
      <h2 className="section-title">📸 Mark Attendance</h2>

      {/* ─── SETUP ──────────────────────────────────────────────────────── */}
      {phase === 'setup' && (
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="card fade-in">
            <div className="card-header">
              <span className="card-title">🚀 Start a New Session</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Enter the subject, then take a live photo of each student.
              The AI will instantly recognize their face and mark attendance.
            </p>
            <div className="form-group">
              <label className="form-label">Subject / Class</label>
              <input
                className="form-input"
                placeholder="e.g. Mathematics 101"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startSession()}
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary w-full"
              style={{ justifyContent: 'center', marginTop: 8 }}
              onClick={startSession}
              disabled={startLoading}
            >
              {startLoading ? '⏳ Starting…' : '▶ Start Session & Open Camera'}
            </button>
          </div>

          {students.length > 0 && (
            <div className="card fade-in" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="card-title">👥 Registered Students ({students.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {students.map(s => (
                  <div key={s.student_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--gradient-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0,
                    }}>{s.name[0]}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.student_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── ACTIVE SESSION ─────────────────────────────────────────────── */}
      {phase === 'session' && (
        <div>
          {/* Session Header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="live-dot" /> <strong>LIVE</strong>
                </span>
                <span className="badge badge-blue">📚 {session?.subject}</span>
                <span className="badge badge-blue">✅ {markedList.length} marked</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  ID: {session?.session_id?.slice(0, 8)}…
                </span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={endSession}>
                ⏹ End Session
              </button>
            </div>
          </div>

          <div className="grid-2">
            {/* Camera Panel */}
            <div className="card fade-in">
              <div className="card-header">
                <span className="card-title">📷 Live Camera</span>
                {cameraReady && <span className="badge badge-low">Camera Ready</span>}
              </div>

              <div style={{
                position: 'relative', borderRadius: 12, overflow: 'hidden',
                background: '#000', border: `2px solid ${cameraReady ? 'var(--accent-green)' : 'var(--border)'}`,
                transition: 'border-color 0.3s ease',
              }}>
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover', transition: 'filter 0.15s' }}
                />
                {!cameraReady && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)', flexDirection: 'column', gap: 12,
                  }}>
                    <span style={{ fontSize: 40 }}>📷</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Camera loading…</span>
                  </div>
                )}

                {/* Face guide overlay */}
                {cameraReady && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 180, height: 220, borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
                      border: '2px dashed rgba(6,182,212,0.5)',
                    }} />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <button
                className={`btn ${capturing ? 'btn-outline' : 'btn-success'} w-full`}
                style={{ justifyContent: 'center', marginTop: 16, fontSize: 16, padding: '14px 24px' }}
                onClick={snapAndMark}
                disabled={capturing || !cameraReady}
              >
                {capturing
                  ? '⏳ Recognizing…'
                  : '📸 Snap & Mark Attendance'}
              </button>

              <StatusBadge result={lastResult} />

              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                💡 Aim the camera at one student at a time, then click the button.
                The AI will recognize their face and mark them present.
              </div>
            </div>

            {/* Marked / Unmarked Panel */}
            <div className="card fade-in">
              <div className="card-header">
                <span className="card-title">🗒 Attendance Board</span>
                <span className="badge badge-blue">{markedList.length}/{students.length}</span>
              </div>

              {/* Marked students */}
              {markedList.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    ✅ Present
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {markedList.map(m => (
                      <div key={m.student_id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', background: 'rgba(16,185,129,0.08)',
                        borderRadius: 8, borderLeft: '3px solid var(--accent-green)',
                        animation: 'fadeIn 0.4s ease',
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {m.student_id} · {m.time}
                          </div>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--accent-green)' }}>
                          {m.confidence != null ? `${(m.confidence * 100).toFixed(0)}%` : '✓'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending students */}
              {students.filter(s => !isMarked(s.student_id)).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    ⏳ Pending
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {students.filter(s => !isMarked(s.student_id)).map(s => (
                      <div key={s.student_id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', background: 'var(--bg-secondary)',
                        borderRadius: 8, opacity: 0.7,
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.student_id}</div>
                        </div>
                        <span style={{ fontSize: 20 }}>👤</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {students.length === 0 && (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div style={{ fontSize: 32 }}>👥</div>
                  <p>No registered students.<br />Register students first from the Students page.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── DONE / SUMMARY ─────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card fade-in" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session Complete!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              <strong style={{ color: 'var(--accent-green)' }}>{markedList.length}</strong> out of{' '}
              <strong>{students.length}</strong> students marked present for <em>{session?.subject}</em>.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { setPhase('setup'); setSession(null); setSubject(''); setMarkedList([]); setLastResult(null); }}>
                ➕ Start New Session
              </button>
              <a className="btn btn-outline" href="/#/attendance">
                📋 View Attendance Records
              </a>
            </div>
          </div>

          {markedList.length > 0 && (
            <div className="card fade-in" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="card-title">✅ Attendance Summary</span>
                <span className="badge badge-low">{markedList.length} Present</span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Student ID</th>
                      <th>Time</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markedList.map(m => (
                      <tr key={m.student_id}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td><span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.student_id}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.time}</td>
                        <td>
                          {m.confidence != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-bar" style={{ width: 60 }}>
                                <div className="progress-fill" style={{ width: `${(m.confidence * 100).toFixed(0)}%`, background: 'var(--gradient-cyan)' }} />
                              </div>
                              <span style={{ fontSize: 12 }}>{(m.confidence * 100).toFixed(0)}%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
