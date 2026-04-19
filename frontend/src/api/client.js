import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('aicis_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aicis_token');
      localStorage.removeItem('aicis_user');
      window.location.href = '/#/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (username, password)   => client.post('/auth/login',    { username, password }),
  register: (username, email, password) => client.post('/auth/register', { username, email, password }),
  me:       ()                     => client.get('/auth/me'),
};

// ── Students ──────────────────────────────────────────────────────────────────
export const studentsAPI = {
  list:     ()            => client.get('/students/'),
  get:      (id)          => client.get(`/students/${id}`),
  register: (student, frames_b64) =>
    client.post('/students/register', student, { params: { frames_b64 } }),
  registerFull: (payload) => client.post('/students/register', payload),
  delete:   (id)          => client.delete(`/students/${id}`),
};

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessionsAPI = {
  create: (subject)        => client.post('/attendance/sessions', { subject }),
  list:   (status)         => client.get('/attendance/sessions', { params: { status } }),
  end:    (sessionId)      => client.put(`/attendance/sessions/${sessionId}/end`),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceAPI = {
  mark:       (session_id, frame_b64) => client.post('/attendance/mark', { session_id, frame_b64 }),
  markPhoto:  (session_id, frame_b64) => client.post('/attendance/mark', { session_id, frame_b64 }),
  list:       (params)                => client.get('/attendance/', { params }),
  exportCsv:  (session_id)            => client.get('/attendance/export-csv', {
    params:       { session_id },
    responseType: 'blob',
  }),
};

// ── Engagement ────────────────────────────────────────────────────────────────
export const engagementAPI = {
  analyze:         (student_id, session_id, frame_b64) =>
    client.post('/engagement/analyze', { student_id, session_id, frame_b64 }),
  history:         (params) => client.get('/engagement/history', { params }),
  timeline:        (session_id) => client.get('/engagement/timeline', { params: { session_id } }),
  studentAverages: (session_id) =>
    client.get('/engagement/student-averages', { params: { session_id } }),
};

// ── Risk ──────────────────────────────────────────────────────────────────────
export const riskAPI = {
  predict:    (payload)    => client.post('/risk/predict', payload),
  all:        ()           => client.get('/risk/all'),
  computeAll: ()           => client.post('/risk/compute-all'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  data: () => client.get('/dashboard/data'),
};

export const WS_BASE = (API_BASE || 'http://localhost:8000')
  .replace('http://', 'ws://')
  .replace('https://', 'wss://');

export default client;
