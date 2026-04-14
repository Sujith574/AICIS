"""
Engagement Detection Service
Uses MediaPipe FaceMesh to compute:
  - Eye Aspect Ratio (EAR)  → blink detection / eye closure
  - Head Pose (pitch / yaw / roll)   → solvePnP
  - Gaze Score           → iris landmark horizontal offset
  - Composite Attention Score (0-100)
"""
import base64
import math
from datetime import datetime
from typing import Optional, Tuple

import cv2
import numpy as np
from mediapipe.python.solutions import face_mesh as mp_face_mesh
# ── MediaPipe setup ───────────────────────────────────────────────────────────
_face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,   # enables iris landmarks
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# ── Landmark indices (MediaPipe 478-point model) ──────────────────────────────
# Eye landmarks (EAR)
LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

# Iris landmarks (refine_landmarks=True)
LEFT_IRIS  = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]

# 3-D model points for head pose (canonical face model in mm)
_3D_MODEL_POINTS = np.array([
    [0.0,    0.0,    0.0   ],   # nose tip        (1)
    [0.0,  -330.0, -65.0  ],   # chin            (152)
    [-225.0, 170.0, -135.0],   # left eye corner (263)
    [225.0,  170.0, -135.0],   # right eye corner(33)
    [-150.0,-150.0, -125.0],   # left mouth      (287)
    [150.0, -150.0, -125.0],   # right mouth     (57)
], dtype=np.float64)

# Corresponding 2-D landmark indices
_POSE_LANDMARK_IDS = [1, 152, 263, 33, 287, 57]

# Blink EAR threshold
EAR_THRESHOLD = 0.20
EAR_CONSEC_FRAMES = 2  # not tracked across calls (stateless)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _decode_frame(b64_str: str) -> Optional[np.ndarray]:
    try:
        header, data = b64_str.split(",", 1) if "," in b64_str else ("", b64_str)
        arr = np.frombuffer(base64.b64decode(data), np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _eye_aspect_ratio(landmarks, eye_ids: list, img_w: int, img_h: int) -> float:
    """Compute EAR from 6 landmark indices."""
    pts = np.array([
        [landmarks[i].x * img_w, landmarks[i].y * img_h]
        for i in eye_ids
    ])
    # vertical distances
    A = np.linalg.norm(pts[1] - pts[5])
    B = np.linalg.norm(pts[2] - pts[4])
    # horizontal distance
    C = np.linalg.norm(pts[0] - pts[3])
    return (A + B) / (2.0 * C + 1e-6)


def _head_pose(landmarks, img_w: int, img_h: int) -> Tuple[float, float, float]:
    """
    Estimate head pitch / yaw / roll using solvePnP.
    Returns angles in degrees.
    """
    image_points = np.array([
        [landmarks[i].x * img_w, landmarks[i].y * img_h]
        for i in _POSE_LANDMARK_IDS
    ], dtype=np.float64)

    focal_length = img_w
    center = (img_w / 2, img_h / 2)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1))

    success, rvec, tvec = cv2.solvePnP(
        _3D_MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not success:
        return 0.0, 0.0, 0.0

    rmat, _ = cv2.Rodrigues(rvec)
    # decompose rotation matrix to Euler angles
    sy = math.sqrt(rmat[0,0]**2 + rmat[1,0]**2)
    singular = sy < 1e-6
    if not singular:
        pitch = math.degrees(math.atan2(rmat[2,1], rmat[2,2]))
        yaw   = math.degrees(math.atan2(-rmat[2,0], sy))
        roll  = math.degrees(math.atan2(rmat[1,0], rmat[0,0]))
    else:
        pitch = math.degrees(math.atan2(-rmat[1,2], rmat[1,1]))
        yaw   = math.degrees(math.atan2(-rmat[2,0], sy))
        roll  = 0.0
    return round(pitch, 2), round(yaw, 2), round(roll, 2)


def _gaze_score(landmarks, img_w: int, img_h: int) -> float:
    """
    Estimate gaze direction using iris offset relative to eye width.
    Returns 0 (looking far away) to 1 (looking straight ahead).
    """
    def iris_offset(iris_ids, eye_ids):
        iris_center = np.mean(
            [[landmarks[i].x * img_w, landmarks[i].y * img_h] for i in iris_ids], axis=0
        )
        eye_pts = np.array(
            [[landmarks[i].x * img_w, landmarks[i].y * img_h] for i in eye_ids]
        )
        eye_left  = eye_pts[0]
        eye_right = eye_pts[3]
        eye_width = np.linalg.norm(eye_right - eye_left) + 1e-6
        offset = abs(iris_center[0] - (eye_left[0] + eye_right[0]) / 2) / eye_width
        return offset

    left_offset  = iris_offset(LEFT_IRIS,  LEFT_EYE)
    right_offset = iris_offset(RIGHT_IRIS, RIGHT_EYE)
    avg_offset   = (left_offset + right_offset) / 2
    # 0 offset → score 1.0, 0.5 offset → score 0.0
    score = max(0.0, 1.0 - avg_offset * 2)
    return round(score, 3)


def _attention_score(ear: float, pitch: float, yaw: float, gaze: float) -> float:
    """
    Composite attention score 0-100.

    Weights:
      - Gaze: 40%  (looking at screen)
      - Head Yaw: 30%  (facing forward)
      - EAR (not closed): 20%
      - Head Pitch: 10%
    """
    # Gaze: 0→0, 1→1
    gaze_score  = gaze * 40.0

    # Yaw score: |yaw| < 15° = full score, degrades to 0 at 45°
    yaw_score = max(0.0, 1.0 - max(0.0, abs(yaw) - 15) / 30.0) * 30.0

    # EAR score: EAR > threshold means eyes open
    ear_score = min(1.0, ear / (EAR_THRESHOLD * 2)) * 20.0

    # Pitch score: |pitch| < 10° = full score
    pitch_score = max(0.0, 1.0 - max(0.0, abs(pitch) - 10) / 20.0) * 10.0

    total = gaze_score + yaw_score + ear_score + pitch_score
    return round(min(100.0, total), 2)


# ── Public API ────────────────────────────────────────────────────────────────
def analyze_frame(frame_b64: str) -> Optional[dict]:
    """
    Analyze engagement from a single base64 frame.
    Returns a dict with all signals, or None if no face detected.
    """
    frame = _decode_frame(frame_b64)
    if frame is None:
        return None

    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = _face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return None

    lms = results.multi_face_landmarks[0].landmark

    left_ear  = _eye_aspect_ratio(lms, LEFT_EYE,  w, h)
    right_ear = _eye_aspect_ratio(lms, RIGHT_EYE, w, h)
    ear = (left_ear + right_ear) / 2

    pitch, yaw, roll = _head_pose(lms, w, h)
    gaze = _gaze_score(lms, w, h)
    blink = ear < EAR_THRESHOLD
    attention = _attention_score(ear, pitch, yaw, gaze)

    return {
        "eye_aspect_ratio": round(ear, 4),
        "head_pitch":       pitch,
        "head_yaw":         yaw,
        "head_roll":        roll,
        "gaze_score":       gaze,
        "blink_detected":   blink,
        "attention_score":  attention,
        "timestamp":        datetime.utcnow(),
    }
