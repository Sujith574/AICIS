"""
Train the Risk Prediction model for AICIS.

Pipeline:
  1. Generate data (or load existing)
  2. Feature scaling (StandardScaler)
  3. Train Random Forest classifier
  4. Evaluate (accuracy, classification report, confusion matrix)
  5. Save model.pkl + scaler.pkl

Run: python ml/train_model.py
"""
import os
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    roc_auc_score,
)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE, "training_data.csv")
MODEL_PATH  = os.path.join(BASE, "model.pkl")
SCALER_PATH = os.path.join(BASE, "scaler.pkl")

# ── Step 1: Generate data if not present ──────────────────────────────────────
if not os.path.exists(DATA_PATH):
    print("⏳  Generating training data...")
    import generate_dummy_data  # noqa: F401

# ── Step 2: Load data ─────────────────────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"\n📊  Dataset: {len(df)} records")
print(df["risk_level"].value_counts())

FEATURES = ["attendance_pct", "avg_attention", "engagement_trend"]
TARGET   = "risk_level"

X = df[FEATURES].values
y = df[TARGET].values

# ── Step 3: Train/test split ──────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# ── Step 4: Scale ─────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)
X_test_sc  = scaler.transform(X_test)

# ── Step 5: Train Random Forest ───────────────────────────────────────────────
print("\n🌲  Training Random Forest classifier...")
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=8,
    min_samples_split=4,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
rf.fit(X_train_sc, y_train)

# ── Step 6: Evaluate ──────────────────────────────────────────────────────────
y_pred = rf.predict(X_test_sc)
acc    = accuracy_score(y_test, y_pred)

print(f"\n✅  Test Accuracy: {acc:.4f}")
print("\n📋  Classification Report:")
print(classification_report(y_test, y_pred))
print("🗂   Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# Cross-validation
cv_scores = cross_val_score(rf, X_train_sc, y_train, cv=5, scoring="accuracy")
print(f"\n🔁  5-Fold CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Feature importance
print("\n⭐  Feature Importances:")
for name, imp in zip(FEATURES, rf.feature_importances_):
    print(f"    {name:<20}: {imp:.4f}")

# ── Step 7: Save ──────────────────────────────────────────────────────────────
joblib.dump(rf, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)
print(f"\n💾  Saved model  → {MODEL_PATH}")
print(f"💾  Saved scaler → {SCALER_PATH}")

# ── Step 8: Quick sanity check ────────────────────────────────────────────────
print("\n🧪  Sanity Check:")
test_cases = [
    ("High risk expected",   [35.0, 25.0, -0.5]),
    ("Medium risk expected", [65.0, 50.0,  0.0]),
    ("Low risk expected",    [92.0, 80.0,  0.3]),
]
for label, vals in test_cases:
    x = scaler.transform([vals])
    pred  = rf.predict(x)[0]
    proba = rf.predict_proba(x)[0]
    print(f"  {label}: → {pred} (proba={dict(zip(rf.classes_, proba.round(2)))})")
