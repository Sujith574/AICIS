import { useState, useRef, useCallback } from 'react';
import { studentsAPI }  from '../api/client';
import WebcamCapture     from '../components/WebcamCapture';
import toast             from 'react-hot-toast';

const CAPTURE_COUNT = 20; // frames to capture for registration

export default function Students() {
  const [students,    setStudents]    = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [form,        setForm]        = useState({ student_id: '', name: '', email: '' });
  const [capturing,   setCapturing]   = useState(false);
  const [captured,    setCaptured]    = useState(0);
  const [registering, setRegistering] = useState(false);
  const [camActive,   setCamActive]   = useState(false);
  const webcamRef  = useRef(null);
  const framesRef  = useRef([]);
  const intervalRef = useRef(null);

  const loadStudents = async () => {
    setLoadingList(true);
    try {
      const { data } = await studentsAPI.list();
      setStudents(data);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingList(false);
    }
  };

  useState(() => { loadStudents(); }, []);

  const startCapture = () => {
    if (!form.student_id || !form.name || !form.email) {
      return toast.error('Fill in all student fields first');
    }
    framesRef.current = [];
    setCaptured(0);
    setCamActive(true);
    setCapturing(true);

    intervalRef.current = setInterval(() => {
      const frame = webcamRef.current?.captureFrame();
      if (frame) {
        framesRef.current.push(frame);
        setCaptured(framesRef.current.length);
        if (framesRef.current.length >= CAPTURE_COUNT) {
          clearInterval(intervalRef.current);
          setCapturing(false);
          toast.success(`Captured ${CAPTURE_COUNT} frames! Click Register.`);
        }
      }
    }, 300);
  };

  const registerStudent = async () => {
    if (framesRef.current.length < 3) return toast.error('Capture more frames first');
    setRegistering(true);
    try {
      await studentsAPI.registerFull({
        student_id:  form.student_id,
        name:        form.name,
        email:       form.email,
        frames_b64:  framesRef.current,
      });
      toast.success(`${form.name} registered successfully!`);
      setForm({ student_id: '', name: '', email: '' });
      setCamActive(false);
      framesRef.current = [];
      setCaptured(0);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const deleteStudent = async (id) => {
    if (!confirm(`Delete student ${id}?`)) return;
    try {
      await studentsAPI.delete(id);
      toast.success('Student deleted');
      loadStudents();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="page-content">
      <h2 className="section-title">👥 Student Management</h2>

      <div className="grid-2">
        {/* Registration Form */}
        <div className="card fade-in">
          <div className="card-header">
            <span className="card-title">➕ Register New Student</span>
          </div>

          <div className="form-group">
            <label className="form-label">Student ID</label>
            <input className="form-input" placeholder="STU001" value={form.student_id}
              onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="Alice Johnson" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="alice@university.edu" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          {/* Webcam */}
          <WebcamCapture ref={webcamRef} active={camActive} />

          {/* Capture progress */}
          {(camActive || captured > 0) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Capturing face samples</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{captured}/{CAPTURE_COUNT}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${(captured / CAPTURE_COUNT) * 100}%`,
                  background: 'var(--gradient-cyan)',
                }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {!camActive ? (
              <button className="btn btn-outline" onClick={startCapture} style={{ flex: 1, justifyContent: 'center' }}>
                📷 Start Capture
              </button>
            ) : (
              <button
                className="btn btn-success"
                onClick={registerStudent}
                disabled={captured < 3 || registering || capturing}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {registering ? '⏳ Registering…' : `✅ Register (${captured} frames)`}
              </button>
            )}
            {camActive && (
              <button className="btn btn-outline btn-sm" onClick={() => { setCamActive(false); clearInterval(intervalRef.current); }}>
                ✖
              </button>
            )}
          </div>
        </div>

        {/* Student List */}
        <div className="card fade-in">
          <div className="card-header">
            <span className="card-title">🎓 Registered Students</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-blue">{students.length}</span>
              <button className="btn btn-outline btn-sm" onClick={loadStudents}>🔄</button>
            </div>
          </div>

          {loadingList ? (
            <div className="loading-overlay" style={{ padding: 40 }}>
              <div className="loading-spinner" />
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">👤</div>
              <h3>No students yet</h3>
              <p>Register a student using the form</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
              {students.map(s => (
                <div key={s.student_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.student_id} · {s.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      by {s.registered_by} · {new Date(s.registered_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => deleteStudent(s.student_id)}
                    style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
