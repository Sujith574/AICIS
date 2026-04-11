"""
Generate synthetic training data for the risk prediction model.
Produces 600 student records with realistic distributions.

Output: ml/training_data.csv
"""
import numpy as np
import pandas as pd
import os

np.random.seed(42)
N = 600

# ── Low Risk (40%) ────────────────────────────────────────────────────────────
n_low = int(N * 0.40)
low = pd.DataFrame({
    "attendance_pct":   np.clip(np.random.normal(88, 7, n_low), 70, 100),
    "avg_attention":    np.clip(np.random.normal(75, 10, n_low), 50, 100),
    "engagement_trend": np.clip(np.random.normal(0.15, 0.20, n_low), -1, 1),
    "risk_level":       "Low",
})

# ── Medium Risk (35%) ─────────────────────────────────────────────────────────
n_med = int(N * 0.35)
med = pd.DataFrame({
    "attendance_pct":   np.clip(np.random.normal(68, 8, n_med), 45, 85),
    "avg_attention":    np.clip(np.random.normal(52, 12, n_med), 25, 75),
    "engagement_trend": np.clip(np.random.normal(-0.05, 0.25, n_med), -1, 1),
    "risk_level":       "Medium",
})

# ── High Risk (25%) ───────────────────────────────────────────────────────────
n_high = N - n_low - n_med
high = pd.DataFrame({
    "attendance_pct":   np.clip(np.random.normal(42, 12, n_high), 0, 65),
    "avg_attention":    np.clip(np.random.normal(28, 10, n_high), 0, 55),
    "engagement_trend": np.clip(np.random.normal(-0.35, 0.20, n_high), -1, 1),
    "risk_level":       "High",
})

df = pd.concat([low, med, high], ignore_index=True).sample(frac=1, random_state=42)

out_path = os.path.join(os.path.dirname(__file__), "training_data.csv")
df.to_csv(out_path, index=False)
print(f"✅  Generated {len(df)} records → {out_path}")
print(df["risk_level"].value_counts())
print(df.describe())
