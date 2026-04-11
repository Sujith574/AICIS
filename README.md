# 🎓 AI Classroom Intelligence System (AICIS)

**Attendance + Engagement + Risk Prediction**

A production-grade Applied ML project that uses face recognition, MediaPipe engagement analysis, and scikit-learn risk prediction to give teachers real-time classroom intelligence.

---

## 🏗️ Architecture

```
Webcam (Browser) →
  WebSocket →
  FastAPI Backend
    ├── OpenCV LBPH      → Face Recognition → Attendance
    ├── MediaPipe FaceMesh → Engagement Signals → Attention Score (0-100)
    └── Random Forest (96.7% acc) → Risk Level (Low / Medium / High)
  MongoDB →
  React Dashboard
```

---

## 📁 Project Structure

```
AICIS/
├── backend/          FastAPI Python backend
│   ├── main.py       Entry point
│   ├── api/          Route handlers (auth, students, attendance, engagement, risk, dashboard)
│   ├── services/     Business logic (face_service, engagement_service, risk_service, auth_service)
│   ├── models/       Pydantic schemas
│   ├── db/           MongoDB async client
│   └── face_data/    Auto-created: LBPH model + captured face images
├── ml/
│   ├── generate_dummy_data.py  → Creates training_data.csv
│   ├── train_model.py          → Trains & saves model
│   ├── model.pkl               → Trained Random Forest
│   └── scaler.pkl              → StandardScaler
├── frontend/         React + Vite + Chart.js dashboard
│   └── src/
│       ├── pages/    Dashboard, Students, Session, Attendance, Risk, Login
│       └── components/ Sidebar, WebcamCapture, EngagementChart, AttentionHeatmap, RiskPanel, InsightsPanel
└── database/
    └── schema.json   MongoDB collection schemas
```

---

## 🚀 Setup & Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running locally on port `27017`

---

### Step 1 — MongoDB
Install and start MongoDB Community Edition.
```powershell
# Or use MongoDB Atlas (update MONGO_URI in backend/.env)
mongod --dbpath C:\data\db
```

---

### Step 2 — Backend

```powershell
cd AICIS\backend

# Install dependencies
python -m pip install -r requirements.txt

# (Optional) Re-train the ML model
cd ..\ml
python train_model.py
cd ..\backend

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> The server creates a default teacher account on startup:
> - **Username:** `teacher`
> - **Password:** `teacher123`

API docs: http://localhost:8000/docs

---

### Step 3 — Frontend

```powershell
cd AICIS\frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## 🔐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Teacher login → JWT token |
| POST | `/auth/register` | Create teacher account |
| POST | `/students/register` | Register student face |
| GET | `/students/` | List all students |
| DELETE | `/students/{id}` | Delete student |
| POST | `/attendance/sessions` | Start a class session |
| PUT | `/attendance/sessions/{id}/end` | End session |
| POST | `/attendance/mark` | Mark attendance via face frame |
| GET | `/attendance/` | Get attendance records |
| GET | `/attendance/export-csv` | Download CSV |
| POST | `/engagement/analyze` | Analyze frame engagement |
| GET | `/engagement/timeline` | Time-bucketed attention scores |
| GET | `/engagement/student-averages` | Per-student averages |
| POST | `/risk/predict` | Predict risk for one student |
| GET | `/risk/all` | All students' risk levels |
| POST | `/risk/compute-all` | Bulk ML inference |
| GET | `/dashboard/data` | Full dashboard payload |
| WS | `/ws/live-session/{id}` | Real-time session WebSocket |

---

## 🧠 ML Model Details

**Algorithm:** Random Forest Classifier (200 trees, depth 8)

**Features:**
| Feature | Importance |
|---------|-----------|
| Attendance % | 45.5% |
| Avg Attention Score | 36.0% |
| Engagement Trend | 18.5% |

**Performance (test set):**
- Accuracy: **96.7%**
- CV 5-fold: **93.96% ± 3.3%**

**Risk labeling:**
- **High** = low attendance + low attention + declining trend
- **Medium** = moderate values
- **Low** = good attendance + high attention

---

## 📊 Engagement Detection (MediaPipe)

Each webcam frame is analyzed for:

| Signal | Landmark Technique | Weight |
|--------|-------------------|--------|
| Gaze direction | Iris offset from eye center | 40% |
| Head yaw | solvePnP Euler angles | 30% |
| Eye Aspect Ratio (blink) | 6-point EAR formula | 20% |
| Head pitch | solvePnP pitch | 10% |

**Attention Score = weighted sum → 0–100**

---

## 🎥 Face Recognition (LBPH)

- **Library:** OpenCV `LBPHFaceRecognizer` (no dlib required)
- **Registration:** Capture 20 frames → detect face → save 100×100 crops → retrain
- **Recognition:** Predict label → if distance < threshold → confident match
- **Confidence:** `1 - (lbph_distance / threshold)` → 0–1

---

## 🏠 Dashboard Features

1. **Stats overview** — students, sessions, avg attention, avg attendance, at-risk count
2. **Engagement Timeline** — Line chart of class attention over time
3. **Attention Heatmap** — Color grid: rows=students, cols=time buckets
4. **Risk Panel** — Sorted by risk level with color badges
5. **Teacher Insights** — Auto-generated from data patterns
6. **Student Summary Table** — Full overview with progress bars

---

## 💬 WebSocket Live Session

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8000/ws/live-session/{session_id}');

// Send frame every 2s
ws.send(JSON.stringify({ frame_b64: "data:image/jpeg;base64,..." }));

// Receive
// { student_id, confidence, engagement: { attention_score, ... }, timestamp }
```

---

## 🔧 Configuration

Edit `backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=aicis_db
SECRET_KEY=your-secret-key
FACE_DATA_DIR=./face_data
MODEL_PATH=../ml/model.pkl
SCALER_PATH=../ml/scaler.pkl
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

---

## ✅ Feature Checklist

- [x] Face recognition attendance (OpenCV LBPH)
- [x] Engagement detection (MediaPipe FaceMesh)
- [x] Eye Aspect Ratio (blink detection)
- [x] Head pose estimation (solvePnP)
- [x] Gaze direction estimation (iris landmarks)
- [x] Attention score 0–100
- [x] MongoDB storage (all collections)
- [x] Random Forest risk prediction (96.7% accuracy)
- [x] React dashboard (5 pages)
- [x] Engagement line chart (Chart.js)
- [x] Attention heatmap
- [x] Risk panel with color badges
- [x] Teacher auto-insights
- [x] CSV export
- [x] Teacher authentication (JWT)
- [x] WebSocket real-time session
- [x] All API endpoints documented
