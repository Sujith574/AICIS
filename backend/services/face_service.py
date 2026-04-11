"""
Face Recognition Service
Uses OpenCV's LBPH (Local Binary Patterns Histograms) face recognizer.
No external dlib/cmake required — pure OpenCV.

Flow:
  Register → capture frames → detect faces → save crops → retrain LBPH
  Recognize → decode frame → detect face → LBPH predict → return student_id
"""
import os
import base64
import uuid
import json
import numpy as np
import cv2
from datetime import datetime
from typing import Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

FACE_DATA_DIR = os.getenv("FACE_DATA_DIR", "./face_data")
RECOGNIZER_PATH = os.path.join(FACE_DATA_DIR, "lbph_model.yml")
LABEL_MAP_PATH  = os.path.join(FACE_DATA_DIR, "label_map.json")
CONFIDENCE_THRESHOLD = 65.0   # lower = stricter (LBPH distance)

os.makedirs(FACE_DATA_DIR, exist_ok=True)

# ── Cascade & Recognizer (module-level singletons) ────────────────────────────
_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_recognizer = cv2.face.LBPHFaceRecognizer_create()

# label_map: {int_label -> student_id}
_label_map: dict = {}

def _load_model():
    global _label_map
    if os.path.exists(RECOGNIZER_PATH) and os.path.exists(LABEL_MAP_PATH):
        _recognizer.read(RECOGNIZER_PATH)
        with open(LABEL_MAP_PATH) as f:
            _label_map = {int(k): v for k, v in json.load(f).items()}
        print(f"✅  LBPH model loaded ({len(_label_map)} students)")

_load_model()


# ── Internal helpers ──────────────────────────────────────────────────────────
def _decode_frame(b64_str: str) -> Optional[np.ndarray]:
    """Decode a base64 JPEG string to a numpy BGR image."""
    try:
        header, data = b64_str.split(",", 1) if "," in b64_str else ("", b64_str)
        img_bytes = base64.b64decode(data)
        arr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        print(f"Frame decode error: {e}")
        return None


def _detect_largest_face(gray: np.ndarray):
    """Return the bounding box of the largest detected face, or None."""
    faces = _cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    # pick largest by area
    return max(faces, key=lambda r: r[2] * r[3])


def _retrain():
    """Rebuild LBPH model from all saved crops."""
    faces, labels = [], []
    for label_str, sid in _label_map.items():
        label = int(label_str)
        student_dir = os.path.join(FACE_DATA_DIR, sid)
        if not os.path.isdir(student_dir):
            continue
        for fname in os.listdir(student_dir):
            if not fname.endswith(".jpg"):
                continue
            img = cv2.imread(os.path.join(student_dir, fname), cv2.IMREAD_GRAYSCALE)
            if img is not None:
                faces.append(img)
                labels.append(label)

    if not faces:
        print("⚠️  No face images to train on.")
        return

    _recognizer.train(faces, np.array(labels))
    _recognizer.save(RECOGNIZER_PATH)
    with open(LABEL_MAP_PATH, "w") as f:
        json.dump({str(k): v for k, v in _label_map.items()}, f)
    print(f"✅  LBPH retrained on {len(faces)} images for {len(_label_map)} students.")


# ── Public API ────────────────────────────────────────────────────────────────
def register_face(student_id: str, frames_b64: list[str]) -> Tuple[bool, str, list[str]]:
    """
    Register a student's face from a list of base64 frames.
    Returns (success, message, saved_paths).
    """
    global _label_map

    # Assign a numeric label
    existing_labels = {v: k for k, v in _label_map.items()}
    if student_id in existing_labels:
        label = existing_labels[student_id]
    else:
        label = max(_label_map.keys(), default=-1) + 1
        _label_map[label] = student_id

    student_dir = os.path.join(FACE_DATA_DIR, student_id)
    os.makedirs(student_dir, exist_ok=True)

    saved_paths = []
    for b64 in frames_b64:
        frame = _decode_frame(b64)
        if frame is None:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        bbox = _detect_largest_face(gray)
        if bbox is None:
            continue
        x, y, w, h = bbox
        face_crop = cv2.resize(gray[y:y+h, x:x+w], (100, 100))
        path = os.path.join(student_dir, f"{uuid.uuid4().hex}.jpg")
        cv2.imwrite(path, face_crop)
        saved_paths.append(path)

    if len(saved_paths) < 3:
        return False, f"Only {len(saved_paths)} valid face frames captured. Need at least 3.", []

    _retrain()
    return True, f"Registered {student_id} with {len(saved_paths)} face samples.", saved_paths


def recognize_face(frame_b64: str) -> Tuple[Optional[str], float]:
    """
    Recognize a face in the given base64 frame.
    Returns (student_id or None, confidence 0-1).
    Higher confidence = better match (we invert LBPH distance).
    """
    if not _label_map:
        return None, 0.0

    frame = _decode_frame(frame_b64)
    if frame is None:
        return None, 0.0

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    bbox = _detect_largest_face(gray)
    if bbox is None:
        return None, 0.0

    x, y, w, h = bbox
    face_crop = cv2.resize(gray[y:y+h, x:x+w], (100, 100))

    try:
        label, distance = _recognizer.predict(face_crop)
    except Exception:
        return None, 0.0

    if distance > CONFIDENCE_THRESHOLD:
        return None, 0.0   # No confident match

    student_id = _label_map.get(int(label))
    # Convert LBPH distance to a 0-1 confidence score
    confidence = max(0.0, 1.0 - distance / CONFIDENCE_THRESHOLD)
    return student_id, round(confidence, 3)


def get_registered_students() -> list[str]:
    """Return list of registered student_ids."""
    return list(_label_map.values())
