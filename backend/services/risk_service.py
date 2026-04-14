"""
Risk Prediction Service
Loads the trained sklearn Random Forest model and predicts student risk level.
"""
import os
import joblib
import numpy as np
from typing import Tuple
from dotenv import load_dotenv

load_dotenv()

_MODEL_PATH  = os.getenv("MODEL_PATH",  "../../ml/model.pkl")
_SCALER_PATH = os.getenv("SCALER_PATH", "../../ml/scaler.pkl")

# Resolve paths relative to this file
_BASE = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH  = os.path.join(_BASE, _MODEL_PATH)
_SCALER_PATH = os.path.join(_BASE, _SCALER_PATH)

_model  = None
_scaler = None


def _load():
    global _model, _scaler
    if os.path.exists(_MODEL_PATH) and os.path.exists(_SCALER_PATH):
        _model  = joblib.load(_MODEL_PATH)
        _scaler = joblib.load(_SCALER_PATH)
        print("✅  Risk model loaded.")
    else:
        print("⚠️  Risk model not found. Run python ml/train_model.py first.")

_load()


def predict_risk(
    attendance_pct: float,
    avg_attention: float,
    engagement_trend: float
) -> Tuple[str, float]:
    """
    Predict risk level for a student.
    Returns (risk_level: 'Low'|'Medium'|'High', probability).
    Falls back to rule-based if model is missing.
    """
    if _model is None or _scaler is None:
        return _rule_based(attendance_pct, avg_attention, engagement_trend)

    X = np.array([[attendance_pct, avg_attention, engagement_trend]])
    X_scaled = _scaler.transform(X)
    proba = _model.predict_proba(X_scaled)[0]
    label_idx = int(np.argmax(proba))
    labels = _model.classes_  # ['High', 'Low', 'Medium'] (sorted)
    risk_level = labels[label_idx]
    probability = float(proba[label_idx])
    return risk_level, round(probability, 3)


def _rule_based(
    attendance_pct: float,
    avg_attention: float,
    engagement_trend: float
) -> Tuple[str, float]:
    """Fallback rule-based risk estimation."""
    score = (attendance_pct * 0.5) + (avg_attention * 0.4) + ((engagement_trend + 1) * 50 * 0.1)
    if score >= 70:
        return "Low", 0.85
    elif score >= 45:
        return "Medium", 0.70
    else:
        return "High", 0.90
