"""
HydroSense AI — Hydraulic Predictive Maintenance Dashboard
Industry 5.0 Demo | WM9QC-15, WMG
"""

import pickle
import json
from pathlib import Path
from datetime import datetime


import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import streamlit as st
from sklearn.metrics import confusion_matrix, classification_report

import os
from openai import OpenAI          # pip install openai  (Groq uses the OpenAI SDK)
from dotenv import load_dotenv
load_dotenv()                      # reads GROQ_API_KEY from .env


@st.cache_resource
def get_groq_client():
    """
    Initialise the Groq client once and cache it.
    Returns None silently if the key is missing so the rest of
    the dashboard still works without a key configured.
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your-groq-key-here":
        return None
    return OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )


# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="HydroSense AI",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

BASE_DIR = Path(__file__).parent.parent

# ─────────────────────────────────────────────
# COLOUR SYSTEM  (light mode)
# ─────────────────────────────────────────────
C_BG     = "#F0F4F8"        # page background — cool light gray
C_CARD   = "#FFFFFF"        # card / panel background
C_BORDER = "#DDE3EC"        # subtle border
C_GREEN  = "#059669"        # emerald — healthy
C_AMBER  = "#D97706"        # amber — degraded
C_RED    = "#DC2626"        # red — critical
C_PURPLE = "#6366F1"        # indigo — brand accent
C_BLUE   = "#2563EB"        # blue — info
C_TEXT   = "#111827"        # near-black primary
C_TEXT2  = "#6B7280"        # medium-gray secondary
C_TEXT3  = "#374151"        # dark-gray body

PLOTLY_LAYOUT = dict(
    template="simple_white",
    paper_bgcolor=C_CARD,
    plot_bgcolor="#F8FAFC",
    font=dict(family="Inter, sans-serif", color=C_TEXT3, size=12),
    margin=dict(l=10, r=10, t=44, b=10),
)

# Reusable axis style applied per-chart via update_xaxes / update_yaxes
AXIS_STYLE = dict(gridcolor="#E9EEF4", linecolor="#DDE3EC", tickcolor="#DDE3EC")
TITLE_FONT = dict(size=13, color=C_TEXT, family="Inter, sans-serif")

TARGETS = ["cooler", "valve", "pump", "accumulator"]
TARGET_ICONS = {"cooler": "🌡️", "valve": "🔧", "pump": "💧", "accumulator": "⚡"}

SENSORS = ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6", "EPS1",
           "FS1", "FS2", "TS1", "TS2", "TS3", "TS4", "VS1", "CE", "CP", "SE"]

SENSOR_GROUPS = {
    "Pressure (bar)": ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6"],
    "Motor Power (W)": ["EPS1"],
    "Flow (l/min)": ["FS1", "FS2"],
    "Temperature (°C)": ["TS1", "TS2", "TS3", "TS4"],
    "Vibration (mm/s)": ["VS1"],
    "Efficiency (%)": ["CE", "SE"],
    "Cooling Power (kW)": ["CP"],
}

# ─────────────────────────────────────────────
# CSS
# ─────────────────────────────────────────────
CUSTOM_CSS = f"""
<style>
  /* ── Base ── */
  .stApp {{ background-color: {C_BG}; }}
  section[data-testid="stSidebar"] {{
    background-color: {C_CARD};
    border-right: 1px solid {C_BORDER};
    box-shadow: 2px 0 8px rgba(0,0,0,0.06);
  }}
  #MainMenu, footer, header {{ visibility: hidden; }}
  .block-container {{ padding-top: 1.2rem; padding-bottom: 2rem; }}

  /* ── Global text colours on light bg ── */
  .stApp, .stApp p, .stApp li, .stApp span,
  .stApp label, .stApp div {{ color: {C_TEXT3}; }}
  h1, h2, h3 {{ color: {C_TEXT} !important; }}

  /* ── Page header ── */
  .dash-header {{
    background: linear-gradient(135deg, #EEF2FF 0%, {C_CARD} 60%);
    border: 1px solid {C_BORDER};
    border-radius: 14px;
    padding: 22px 30px;
    margin-bottom: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(99,102,241,0.08);
  }}
  .dash-title {{
    font-size: 1.65rem; font-weight: 800;
    color: {C_TEXT}; margin: 0;
    letter-spacing: -0.02em;
  }}
  .dash-sub {{ font-size: 0.83rem; color: {C_TEXT2}; margin: 5px 0 0 0; }}
  .badge-i5 {{
    background: linear-gradient(135deg, {C_PURPLE}, #4F46E5);
    color: #fff; font-size: 0.68rem; font-weight: 700;
    padding: 5px 12px; border-radius: 20px;
    letter-spacing: 0.06em; text-transform: uppercase;
    box-shadow: 0 2px 6px rgba(99,102,241,0.35);
  }}

  /* ── Health cards ── */
  .health-card {{
    background: {C_CARD};
    border: 1px solid {C_BORDER};
    border-radius: 14px;
    padding: 22px;
    height: 100%;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    transition: box-shadow 0.2s;
  }}
  .health-card:hover {{ box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
  .health-card::before {{
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    border-radius: 14px 14px 0 0;
  }}
  .card-green::before {{ background: linear-gradient(90deg, {C_GREEN}, #34D399); }}
  .card-amber::before {{ background: linear-gradient(90deg, {C_AMBER}, #FBB040); }}
  .card-red::before   {{ background: linear-gradient(90deg, {C_RED},   #F87171); }}

  .card-icon  {{ font-size: 2.2rem; line-height: 1; margin-bottom: 4px; }}
  .card-title {{
    font-size: 0.72rem; text-transform: uppercase;
    letter-spacing: 0.12em; color: {C_TEXT2};
    margin: 10px 0 4px; font-weight: 600;
  }}
  .card-state {{ font-size: 1.1rem; font-weight: 800; color: {C_TEXT}; margin: 0 0 10px; }}

  .status-badge {{
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.7rem; font-weight: 700;
    padding: 4px 11px; border-radius: 20px;
    letter-spacing: 0.04em;
  }}
  .badge-green {{ background: #D1FAE5; color: #065F46; }}
  .badge-amber {{ background: #FEF3C7; color: #92400E; }}
  .badge-red   {{ background: #FEE2E2; color: #991B1B; }}

  .card-confidence {{
    font-size: 0.79rem; color: {C_TEXT2}; margin: 10px 0 4px;
  }}
  .card-confidence span {{ color: {C_TEXT}; font-weight: 700; }}
  .card-rec {{
    font-size: 0.77rem; color: {C_TEXT2}; margin-top: 12px;
    line-height: 1.5; border-top: 1px solid {C_BORDER};
    padding-top: 10px;
  }}

  /* ── Info / alert boxes ── */
  .info-box {{
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    border-left: 4px solid {C_BLUE};
    border-radius: 8px;
    padding: 14px 18px; margin: 12px 0;
    font-size: 0.85rem; color: #1E40AF; line-height: 1.65;
  }}
  .info-box strong {{ color: {C_BLUE}; }}

  .warn-box {{
    background: #FFF5F5;
    border: 1px solid #FECACA;
    border-left: 4px solid {C_RED};
    border-radius: 8px;
    padding: 14px 18px; margin: 12px 0;
    font-size: 0.85rem; color: #7F1D1D; line-height: 1.65;
  }}
  .warn-box strong {{ color: {C_RED}; }}

  .success-box {{
    background: #ECFDF5;
    border: 1px solid #A7F3D0;
    border-left: 4px solid {C_GREEN};
    border-radius: 8px;
    padding: 14px 18px; margin: 12px 0;
    font-size: 0.85rem; color: #064E3B; line-height: 1.65;
  }}
  .success-box strong {{ color: {C_GREEN}; }}

  /* ── Section headers ── */
  .section-header {{
    font-size: 0.95rem; font-weight: 700; color: {C_TEXT};
    border-left: 4px solid {C_PURPLE};
    padding-left: 10px;
    margin: 24px 0 14px;
    letter-spacing: -0.01em;
  }}

  /* ── Footer ── */
  .dash-footer {{
    text-align: center;
    font-size: 0.74rem; color: {C_TEXT2};
    border-top: 1px solid {C_BORDER};
    padding: 18px 0 0; margin-top: 32px;
  }}

  /* ── Metric cards ── */
  [data-testid="metric-container"] {{
    background: {C_CARD};
    border: 1px solid {C_BORDER};
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }}
  [data-testid="metric-container"] label {{
    color: {C_TEXT2} !important; font-size: 0.78rem !important;
    font-weight: 600 !important; text-transform: uppercase;
    letter-spacing: 0.06em;
  }}
  [data-testid="metric-container"] [data-testid="stMetricValue"] {{
    color: {C_TEXT} !important; font-size: 1.4rem !important; font-weight: 800 !important;
  }}

  /* ── Sidebar nav ── */
  .sidebar-section {{
    font-size: 0.68rem; text-transform: uppercase;
    letter-spacing: 0.12em; color: {C_TEXT2};
    margin: 18px 0 6px 0; font-weight: 600;
  }}

  /* ── Radio button styling ── */
  div[data-testid="stRadio"] label {{
    font-size: 0.87rem !important; color: {C_TEXT} !important;
  }}

  /* ── Dataframe / table ── */
  .stDataFrame {{ border-radius: 10px; overflow: hidden; }}

  /* ── Streamlit select / slider labels ── */
  .stSelectbox label, .stSlider label {{
    color: {C_TEXT2} !important; font-size: 0.8rem !important; font-weight: 600 !important;
  }}

  /* ── Plotly chart wrapper ── */
  .js-plotly-plot .plotly .modebar {{ background: transparent !important; }}
</style>
"""

# ─────────────────────────────────────────────
# DATA LOADING (cached)
# ─────────────────────────────────────────────
@st.cache_resource
def load_all_data():
    with open(BASE_DIR / "models" / "xgb_tuned.pkl", "rb") as f:
        model = pickle.load(f)

    X_test = pd.read_parquet(BASE_DIR / "models" / "X_test.parquet", engine="fastparquet")
    y_test = pd.read_csv(BASE_DIR / "models" / "y_test.csv")
    y_pred = pd.read_csv(BASE_DIR / "models" / "y_pred_test.csv")

    with open(BASE_DIR / "data" / "processed" / "label_mappings.json") as f:
        label_maps = json.load(f)

    with open(BASE_DIR / "models" / "results_summary.json") as f:
        results = json.load(f)

    shap_arrays = {
        "cooler": np.load(BASE_DIR / "data" / "shap" / "shap_cooler.npy"),
        "valve": np.load(BASE_DIR / "data" / "shap" / "shap_valve.npy"),
        "pump": np.load(BASE_DIR / "data" / "shap" / "shap_pump.npy"),
        "accumulator": np.load(BASE_DIR / "data" / "shap" / "shap_accumulator.npy"),
    }

    shap_importance = pd.read_csv(BASE_DIR / "data" / "shap" / "shap_mean_abs_importance.csv")
    shap_importance = shap_importance.rename(columns={"Unnamed: 0": "feature"})

    # Load sensor raw data (1449 cycles × samples)
    sensors = {}
    for s in SENSORS:
        sensors[s] = pd.read_parquet(
            BASE_DIR / "data" / "processed" / "sensors" / f"{s}.parquet",
            engine="fastparquet"
        )

    # Precompute predict_proba for all test cycles
    probas = {}
    for i, t in enumerate(TARGETS):
        probas[t] = model.estimators_[i].predict_proba(X_test)

    # Full feature matrix for sensor stats
    features_full = pd.read_parquet(
        BASE_DIR / "data" / "processed" / "features.parquet", engine="fastparquet"
    )
    labels_enc = pd.read_csv(BASE_DIR / "data" / "processed" / "labels_encoded.csv")

    return {
        "model": model,
        "X_test": X_test,
        "y_test": y_test,
        "y_pred": y_pred,
        "label_maps": label_maps,
        "results": results,
        "shap_arrays": shap_arrays,
        "shap_importance": shap_importance,
        "sensors": sensors,
        "probas": probas,
        "features_full": features_full,
        "labels_enc": labels_enc,
    }


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def health_status(target, predicted_class):
    critical = {"cooler": [0], "valve": [0, 1], "pump": [2], "accumulator": [0]}
    degraded = {"cooler": [1], "valve": [2], "pump": [1], "accumulator": [1, 2]}
    if predicted_class in critical[target]:
        return ("🔴 CRITICAL", C_RED, "red")
    elif predicted_class in degraded[target]:
        return ("🟡 DEGRADED", C_AMBER, "amber")
    else:
        return ("🟢 HEALTHY", C_GREEN, "green")


def get_recommendation(status_label, target):
    if "CRITICAL" in status_label:
        return "⚠️ Immediate inspection required — schedule maintenance within 24 hrs. Requires engineer sign-off."
    elif "DEGRADED" in status_label:
        return "🔔 Monitor closely — schedule inspection within 7 days. Requires engineer sign-off."
    else:
        return "✅ Operating normally — next scheduled check in 30 days. Requires engineer sign-off."


def get_class_label(target, cls_int, label_maps):
    return label_maps["label_decodings"][target][str(cls_int)]


def render_header(subtitle=""):
    ts = datetime.now().strftime("%d %b %Y  %H:%M")
    st.markdown(f"""
    <div class="dash-header">
      <div>
        <p class="dash-title">⚙️ HydroSense AI — Hydraulic Plant Monitor</p>
        <p class="dash-sub">Industry 5.0 Predictive Maintenance Platform &nbsp;|&nbsp; {subtitle or 'Chemical Process Division'}</p>
      </div>
      <div style="text-align:right">
        <span class="badge-i5">✦ Industry 5.0 Ready</span>
        <p style="font-size:0.75rem;color:{C_TEXT2};margin:8px 0 0">Session: {ts}</p>
      </div>
    </div>
    """, unsafe_allow_html=True)


def render_footer():
    st.markdown(
        '<div class="dash-footer">HydroSense AI &nbsp;|&nbsp; Augmenting human expertise, not replacing it'
        ' &nbsp;|&nbsp; WM9QC-15 WMG</div>',
        unsafe_allow_html=True,
    )


#LLM Chat helper functions
GROQ_MODEL = "llama-3.3-70b-versatile"   # fast, capable, free tier

SUGGESTED_QUESTIONS = [
    "Why is the pump being flagged?",
    "What maintenance action should I take right now?",
    "Explain the top SHAP features for the valve in plain English.",
    "How confident is the model in these predictions?",
    "What does the flow imbalance reading mean physically?",
    "Is this system safe to keep running or should I shut it down?",
]


def build_system_prompt(data: dict, cycle_idx: int) -> str:
    """
    Builds a context-aware system prompt injecting the live plant data
    for the currently selected cycle so the LLM answers are grounded
    in the actual model outputs — not generic training knowledge.
    """
    label_decodings = data["label_maps"]["label_decodings"]

    # ── Component health states + confidence ──────────────────────
    health     = {}
    confidence = {}
    status_str = {}

    for target in TARGETS:
        pred_cls            = int(data["y_pred"].iloc[cycle_idx][target])
        health[target]      = label_decodings[target][str(pred_cls)]
        status_str[target]  = health_status(target, pred_cls)[0]

        # Confidence from pre-computed probas
        try:
            proba               = data["probas"][target][cycle_idx]
            confidence[target]  = f"{proba[pred_cls]*100:.0f}%"
        except Exception:
            confidence[target]  = "N/A"

    # ── Top 3 SHAP features per target ────────────────────────────
    shap_imp       = data["shap_importance"]
    top_shap_lines = {}

    for target in TARGETS:
        if shap_imp is not None and target in shap_imp.columns:
            top3  = shap_imp.set_index("feature")[target].nlargest(3)
            lines = []
            for feat, imp in top3.items():
                if feat in data["X_test"].columns:
                    val = data["X_test"].iloc[cycle_idx][feat]
                    lines.append(f"    • {feat}: sensor value = {val:.3f}  (SHAP importance = {imp:.4f})")
                else:
                    lines.append(f"    • {feat}  (SHAP importance = {imp:.4f})")
            top_shap_lines[target] = "\n".join(lines)
        else:
            top_shap_lines[target] = "    • SHAP data unavailable"

    # ── Sensor group means for this cycle ─────────────────────────
    sensor_lines = []
    sensor_summary_groups = {
        "Pressure (bar)":       ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6"],
        "Flow (l/min)":         ["FS1", "FS2"],
        "Temperature (°C)":     ["TS1", "TS2", "TS3", "TS4"],
        "Motor power (W)":      ["EPS1"],
        "Vibration (mm/s)":     ["VS1"],
    }
    for group, sensors_list in sensor_summary_groups.items():
        vals = []
        for s in sensors_list:
            col = f"{s}_mean"
            if col in data["X_test"].columns:
                vals.append(f"{s}={data['X_test'].iloc[cycle_idx][col]:.2f}")
        if vals:
            sensor_lines.append(f"  {group}: {', '.join(vals)}")

    # ── Overall alert level ───────────────────────────────────────
    critical_list = [t for t in TARGETS if "CRITICAL" in status_str[t]]
    degraded_list = [t for t in TARGETS if "DEGRADED" in status_str[t]]

    if critical_list:
        overall = f"⚠️  CRITICAL — {', '.join(critical_list)} require immediate attention"
    elif degraded_list:
        overall = f"🟡  DEGRADED — {', '.join(degraded_list)} should be inspected soon"
    else:
        overall = "🟢  ALL SYSTEMS HEALTHY — no immediate action required"

    # ── Assemble prompt ───────────────────────────────────────────
    return f"""You are HydroSense AI, an expert engineering assistant embedded in a \
predictive maintenance dashboard for a chemical processing plant.

Your role is to help chemical plant engineers and operations managers understand the \
health of their hydraulic systems, interpret AI model predictions, and make informed \
maintenance decisions. This is an Industry 5.0 system — you augment engineering \
judgement, you never replace it. Every maintenance recommendation must end with \
"⚠️ Requires engineer sign-off before action is taken."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIVE PLANT STATUS — Test Cycle {cycle_idx}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall: {overall}

Component health (AI predictions):
  🌡️  Cooler:      {health['cooler']}   {status_str['cooler']}   confidence: {confidence['cooler']}
  🔧  Valve:       {health['valve']}   {status_str['valve']}   confidence: {confidence['valve']}
  💧  Pump:        {health['pump']}   {status_str['pump']}   confidence: {confidence['pump']}
  ⚡  Accumulator: {health['accumulator']}   {status_str['accumulator']}   confidence: {confidence['accumulator']}

Sensor readings (cycle means):
{chr(10).join(sensor_lines)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY THE MODEL FLAGGED EACH COMPONENT (SHAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cooler — top driving features:
{top_shap_lines['cooler']}

Valve — top driving features:
{top_shap_lines['valve']}

Pump — top driving features:
{top_shap_lines['pump']}

Accumulator — top driving features:
{top_shap_lines['accumulator']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYSTEM CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dataset: UCI Hydraulic Systems (ZeMA testbed, 1449 stable cycles)
Model: XGBoost multi-output classifier, 211 features, 5-fold CV macro F1 ≈ 0.99
Plant type: Chemical processing — COMAH/ATEX/DSEAR regulated, safety-critical
Industry 5.0: AI surfaces insights, human engineers make all final decisions

Response style:
- Be direct and practical — 3–6 sentences for most answers
- Use bullet points for multi-step recommendations
- Reference specific sensor names and values when explaining predictions
- Never fabricate data not shown above
- Always end maintenance recommendations with the sign-off reminder"""


def chat_turn(client, messages: list, system_prompt: str):
    """
    Stream one assistant turn and yield text chunks as they arrive.
    Wraps the Groq API call so errors surface cleanly.
    """
    try:
        stream = client.chat.completions.create(
            model    = GROQ_MODEL,
            messages = [{"role": "system", "content": system_prompt}] + messages,
            stream   = True,
            max_tokens     = 600,
            temperature    = 0.3,    # low temp = consistent, factual answers
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as e:
        yield f"\n\n⚠️  API error: {str(e)}\n\nCheck your GROQ_API_KEY in .env"


def render_health_mini_cards(data: dict, cycle_idx: int):
    """
    Compact 4-column health state display used inside the chat page
    as context so the engineer knows what they're asking about.
    """
    cols = st.columns(4)
    for col, target in zip(cols, TARGETS):
        pred_cls    = int(data["y_pred"].iloc[cycle_idx][target])
        state_label = data["label_maps"]["label_decodings"][target][str(pred_cls)]
        lbl, color, color_cls = health_status(target, pred_cls)

        with col:
            st.markdown(
                f"<div style='"
                f"background:{C_CARD};border:1px solid {C_BORDER};"
                f"border-top:3px solid {color};"
                f"border-radius:10px;padding:12px 14px;"
                f"box-shadow:0 1px 4px rgba(0,0,0,0.05)'>"
                f"<div style='font-size:1.3rem'>{TARGET_ICONS[target]}</div>"
                f"<div style='font-size:0.7rem;text-transform:uppercase;"
                f"letter-spacing:0.1em;color:{C_TEXT2};margin:6px 0 2px'>"
                f"{target.capitalize()}</div>"
                f"<div style='font-size:0.85rem;font-weight:700;color:{C_TEXT}'>"
                f"{state_label}</div>"
                f"<div style='font-size:0.72rem;color:{color};font-weight:600;margin-top:4px'>"
                f"{lbl}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )    


def health_card_html(icon, name, state_label, status_label, color_cls, confidence, rec):
    badge_cls = f"badge-{color_cls}"
    return f"""
    <div class="health-card card-{color_cls}">
      <div class="card-icon">{icon}</div>
      <div class="card-title">{name}</div>
      <div class="card-state">{state_label.replace('_', ' ').title()}</div>
      <span class="status-badge {badge_cls}">{status_label}</span>
      <div class="card-confidence">Confidence: <span>{confidence:.1f}%</span></div>
      <div class="card-rec">{rec}</div>
    </div>
    """


def plotly_cfg(**kwargs):
    """Merge caller overrides into the shared Plotly layout dict."""
    cfg = dict(PLOTLY_LAYOUT)
    cfg.update(kwargs)
    return cfg

# Keep old alias so existing call sites work without change
plotly_dark = plotly_cfg


# ─────────────────────────────────────────────
# PAGE 1: PLANT OVERVIEW
# ─────────────────────────────────────────────
def page_overview(data, cycle_idx):
    render_header("Plant Overview")

    y_pred = data["y_pred"]
    label_maps = data["label_maps"]
    probas = data["probas"]

    # ── 4 health cards ──────────────────────────────────────────
    cols = st.columns(4)
    for col, target in zip(cols, TARGETS):
        pred_cls = int(y_pred.iloc[cycle_idx][target])
        proba_pct = probas[target][cycle_idx][pred_cls] * 100
        state_label = get_class_label(target, pred_cls, label_maps)
        status_label, _, color_cls = health_status(target, pred_cls)
        rec = get_recommendation(status_label, target)
        with col:
            st.markdown(
                health_card_html(
                    TARGET_ICONS[target], target.capitalize(),
                    state_label, status_label, color_cls, proba_pct, rec
                ),
                unsafe_allow_html=True,
            )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── I5.0 callout ────────────────────────────────────────────
    st.markdown("""
    <div class="info-box">
    <strong>Industry 5.0 Principle:</strong> This system augments your engineering team —
    all recommendations surface AI-detected anomalies but <strong>require engineer
    sign-off before any maintenance action is taken</strong>. Human expertise remains
    central to every decision.
    </div>
    """, unsafe_allow_html=True)

    # ── System health summary bar ────────────────────────────────
    st.markdown('<div class="section-header">System Health Distribution — All Test Cycles</div>', unsafe_allow_html=True)

    fig = make_subplots(rows=1, cols=4, subplot_titles=[t.capitalize() for t in TARGETS])
    colors_map = {"🔴 CRITICAL": C_RED, "🟡 DEGRADED": C_AMBER, "🟢 HEALTHY": C_GREEN}

    for col_i, target in enumerate(TARGETS, 1):
        counts = {"🟢 HEALTHY": 0, "🟡 DEGRADED": 0, "🔴 CRITICAL": 0}
        for idx in range(len(y_pred)):
            cls = int(y_pred.iloc[idx][target])
            lbl, _, _ = health_status(target, cls)
            counts[lbl] = counts.get(lbl, 0) + 1

        total = sum(counts.values())
        for status, cnt in counts.items():
            fig.add_trace(
                go.Bar(
                    name=status, x=[cnt / total * 100], y=[target.capitalize()],
                    orientation="h",
                    marker_color=colors_map[status],
                    text=f"{cnt/total*100:.0f}%",
                    textposition="inside",
                    showlegend=(col_i == 1),
                    hovertemplate=f"{status}: {cnt} cycles ({cnt/total*100:.1f}%)<extra></extra>",
                ),
                row=1, col=col_i,
            )

    fig.update_layout(
        **plotly_dark(height=140, barmode="stack", margin=dict(l=10, r=10, t=30, b=10)),
        showlegend=True,
        legend=dict(orientation="h", x=0, y=-0.3),
    )
    fig.update_xaxes(range=[0, 100], showticklabels=False)
    fig.update_yaxes(showticklabels=False)
    st.plotly_chart(fig, use_container_width=True)

    # ── Ground truth vs prediction for selected cycle ─────────────
    st.markdown('<div class="section-header">Cycle Detail — Prediction vs Ground Truth</div>', unsafe_allow_html=True)

    y_test = data["y_test"]
    c1, c2, c3, c4 = st.columns(4)
    for col, target in zip([c1, c2, c3, c4], TARGETS):
        pred_cls = int(y_pred.iloc[cycle_idx][target])
        true_cls = int(y_test.iloc[cycle_idx][target])
        pred_lbl = get_class_label(target, pred_cls, label_maps)
        true_lbl = get_class_label(target, true_cls, label_maps)
        correct = pred_cls == true_cls
        icon = "✅" if correct else "❌"
        with col:
            st.metric(
                label=f"{TARGET_ICONS[target]} {target.capitalize()}",
                value=pred_lbl.title(),
                delta=f"{icon} True: {true_lbl.title()}",
                delta_color="normal" if correct else "inverse",
            )

    render_footer()


# ─────────────────────────────────────────────
# PAGE 2: SENSOR INTELLIGENCE
# ─────────────────────────────────────────────
def page_sensors(data, cycle_idx):
    render_header("Sensor Intelligence")

    sensors = data["sensors"]
    y_pred = data["y_pred"]
    label_maps = data["label_maps"]
    features_full = data["features_full"]
    labels_enc = data["labels_enc"]

    # ── Compact health summary ────────────────────────────────────
    st.markdown('<div class="section-header">Component Health — Selected Cycle</div>', unsafe_allow_html=True)
    cols = st.columns(4)
    for col, target in zip(cols, TARGETS):
        pred_cls = int(y_pred.iloc[cycle_idx][target])
        state_label = get_class_label(target, pred_cls, label_maps)
        status_label, color, _ = health_status(target, pred_cls)
        with col:
            st.markdown(
                f"<div style='background:{C_CARD};border:1px solid {C_BORDER};border-radius:10px;"
                f"padding:14px;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,0.06)'>"
                f"<div style='font-size:1.4rem'>{TARGET_ICONS[target]}</div>"
                f"<div style='font-size:0.75rem;color:{C_TEXT2};text-transform:uppercase'>{target}</div>"
                f"<div style='font-size:0.85rem;font-weight:600;color:{C_TEXT};margin:4px 0'>{state_label.title()}</div>"
                f"<div style='font-size:0.75rem;color:{color}'>{status_label}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Sensor signal viewer ──────────────────────────────────────
    st.markdown('<div class="section-header">Raw Sensor Signal Viewer</div>', unsafe_allow_html=True)

    sel_col, overlay_col, _ = st.columns([2, 2, 3])
    with sel_col:
        selected_sensor = st.selectbox(
            "Select sensor",
            SENSORS,
            format_func=lambda s: f"{s} — "
            + next(k for k, v in SENSOR_GROUPS.items() if s in v),
        )
    with overlay_col:
        show_overlay = st.toggle("Overlay healthy reference cycle", value=False)

    sensor_data = sensors[selected_sensor]
    cycle_signal = sensor_data.iloc[cycle_idx % len(sensor_data)].values.astype(float)
    hz = next(
        v["hz"]
        for k, v in data["label_maps"]["sensor_meta"].items()
        if k == selected_sensor
    )
    unit = data["label_maps"]["sensor_meta"][selected_sensor]["unit"]
    t = np.arange(len(cycle_signal)) / hz

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=t, y=cycle_signal,
        name=f"Cycle {cycle_idx}",
        line=dict(color=C_PURPLE, width=1.5),
        hovertemplate=f"t=%{{x:.2f}}s &nbsp; {selected_sensor}=%{{y:.3f}} {unit}<extra></extra>",
    ))

    if show_overlay:
        # Find a cycle classified as fully healthy across all targets
        healthy_mask = (
            (labels_enc["cooler"] == 2) &
            (labels_enc["valve"] == 3) &
            (labels_enc["pump"] == 0) &
            (labels_enc["accumulator"] == 3)
        )
        healthy_idxs = labels_enc.index[healthy_mask].tolist()
        if healthy_idxs:
            ref_idx = healthy_idxs[0]
            ref_signal = sensor_data.iloc[ref_idx % len(sensor_data)].values.astype(float)
            fig.add_trace(go.Scatter(
                x=t, y=ref_signal,
                name="Healthy reference",
                line=dict(color=C_GREEN, width=1.5, dash="dot"),
                opacity=0.7,
                hovertemplate=f"t=%{{x:.2f}}s &nbsp; {selected_sensor}=%{{y:.3f}} {unit} (ref)<extra></extra>",
            ))

    fig.update_layout(
        **plotly_dark(height=320),
        title=dict(text=f"{selected_sensor} — Cycle {cycle_idx}  [{unit}]", font=dict(size=13)),
        xaxis_title="Time (s)",
        yaxis_title=f"{selected_sensor} ({unit})",
        legend=dict(x=0.01, y=0.99),
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Sensor statistics table ───────────────────────────────────
    st.markdown('<div class="section-header">Sensor Statistics — Current Cycle vs All-Cycle Mean</div>', unsafe_allow_html=True)

    feat_row = features_full.iloc[cycle_idx % len(features_full)]
    stats_rows = []
    for sensor in SENSORS:
        cols_for_sensor = [c for c in features_full.columns if c.startswith(sensor + "_")]
        if not cols_for_sensor:
            continue
        for stat in ["mean", "std", "min", "max", "rms"]:
            col_name = f"{sensor}_{stat}"
            if col_name in features_full.columns:
                val = float(feat_row[col_name])
                global_mean = float(features_full[col_name].mean())
                global_std = float(features_full[col_name].std())
                z = (val - global_mean) / (global_std + 1e-9)
                stats_rows.append({
                    "Sensor": sensor,
                    "Stat": stat.upper(),
                    "Value": round(val, 4),
                    "Global Mean": round(global_mean, 4),
                    "Z-score": round(z, 2),
                    "Status": "🔴" if abs(z) > 3 else ("🟡" if abs(z) > 2 else "🟢"),
                })

    if stats_rows:
        stats_df = pd.DataFrame(stats_rows)
        # show only selected sensor for brevity
        shown = stats_df[stats_df["Sensor"] == selected_sensor]
        st.dataframe(
            shown.style.map(
                lambda v: f"color: {C_RED}" if v == "🔴" else (f"color: {C_AMBER}" if v == "🟡" else f"color: {C_GREEN}"),
                subset=["Status"],
            ).format({"Value": "{:.4f}", "Global Mean": "{:.4f}", "Z-score": "{:.2f}"}),
            use_container_width=True,
            hide_index=True,
        )

    # ── Multi-sensor sparklines ────────────────────────────────────
    st.markdown('<div class="section-header">All-Sensor Overview — Cycle Snapshot</div>', unsafe_allow_html=True)

    n_cols = 6
    rows_needed = -(-len(SENSORS) // n_cols)
    fig_spark = make_subplots(rows=rows_needed, cols=n_cols, vertical_spacing=0.06, horizontal_spacing=0.04)

    for i, sensor in enumerate(SENSORS):
        row = i // n_cols + 1
        col = i % n_cols + 1
        sig = sensors[sensor].iloc[cycle_idx % len(sensors[sensor])].values.astype(float)
        hz_s = data["label_maps"]["sensor_meta"][sensor]["hz"]
        t_s = np.arange(len(sig)) / hz_s
        # downsample for sparkline
        step = max(1, len(sig) // 200)
        fig_spark.add_trace(
            go.Scatter(x=t_s[::step], y=sig[::step], mode="lines",
                       line=dict(color=C_BLUE, width=1), name=sensor,
                       showlegend=False,
                       hovertemplate=f"{sensor}: %{{y:.2f}}<extra></extra>"),
            row=row, col=col,
        )
        fig_spark.update_xaxes(showticklabels=False, row=row, col=col, showgrid=False)
        fig_spark.update_yaxes(showticklabels=False, row=row, col=col, showgrid=False)
        # sensor name as annotation
        fig_spark.add_annotation(
            text=sensor, row=row, col=col, xref="paper", yref="paper",
            showarrow=False,
            font=dict(size=9, color=C_TEXT2),
            x=(col - 0.5) / n_cols,
            y=1 - (row - 0.5) / rows_needed,
            xanchor="center", yanchor="bottom",
        )

    fig_spark.update_layout(
        **plotly_dark(height=rows_needed * 90 + 20),
        title=dict(text=f"All 17 Sensors — Cycle {cycle_idx}", font=dict(size=12)),
    )
    st.plotly_chart(fig_spark, use_container_width=True)

    render_footer()


# ─────────────────────────────────────────────
# PAGE 3: AI EXPLANATION (SHAP)
# ─────────────────────────────────────────────
def page_shap(data, cycle_idx):
    render_header("AI Explanation (SHAP)")

    shap_arrays = data["shap_arrays"]
    shap_importance = data["shap_importance"]
    X_test = data["X_test"]
    y_pred = data["y_pred"]
    probas = data["probas"]
    label_maps = data["label_maps"]
    feature_names = list(X_test.columns)

    st.markdown("""
    <div class="info-box">
    <strong>Why did the AI make this prediction?</strong><br>
    SHAP (SHapley Additive exPlanations) is a mathematically rigorous method that assigns
    each sensor feature a contribution score for a given prediction — positive values push
    the model toward a fault class, negative values push it away.
    This page makes the AI's reasoning transparent so engineers can validate or challenge every decision.
    </div>
    """, unsafe_allow_html=True)

    tabs = st.tabs([f"{TARGET_ICONS[t]} {t.capitalize()}" for t in TARGETS])

    for tab, target in zip(tabs, TARGETS):
        with tab:
            pred_cls = int(y_pred.iloc[cycle_idx][target])
            confidence = probas[target][cycle_idx][pred_cls] * 100
            state_label = get_class_label(target, pred_cls, label_maps)
            status_label, color, color_cls = health_status(target, pred_cls)

            # Prediction summary
            c1, c2, c3 = st.columns([2, 2, 3])
            with c1:
                st.metric(f"{TARGET_ICONS[target]} Prediction", state_label.title())
            with c2:
                st.metric("Confidence", f"{confidence:.1f}%")
            with c3:
                st.markdown(
                    f"<div style='padding:14px;background:{C_CARD};border-radius:10px;"
                    f"border:1px solid {C_BORDER};box-shadow:0 1px 6px rgba(0,0,0,0.06)'>"
                    f"<span class='status-badge badge-{color_cls}'>{status_label}</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )

            st.markdown("<br>", unsafe_allow_html=True)

            # SHAP waterfall for predicted class
            shap_vals = shap_arrays[target][pred_cls, cycle_idx, :]  # (n_features,)
            top_n = 12
            top_idx = np.argsort(np.abs(shap_vals))[::-1][:top_n]
            top_vals = shap_vals[top_idx]
            top_names = [feature_names[i] for i in top_idx]
            top_feat_vals = [float(X_test.iloc[cycle_idx, i]) for i in top_idx]

            bar_colors = [C_RED if v > 0 else C_BLUE for v in top_vals]
            labels = [
                f"{n}<br><span style='font-size:9px'>val={v:.3f}</span>"
                for n, v in zip(top_names, top_feat_vals)
            ]

            fig_wf = go.Figure()
            fig_wf.add_trace(go.Bar(
                y=labels[::-1],
                x=top_vals[::-1],
                orientation="h",
                marker_color=bar_colors[::-1],
                text=[f"{v:+.4f}" for v in top_vals[::-1]],
                textposition="outside",
                hovertemplate=(
                    "<b>%{y}</b><br>SHAP contribution: %{x:.4f}"
                    "<extra></extra>"
                ),
            ))
            fig_wf.add_vline(x=0, line_color=C_TEXT2, line_width=1)
            fig_wf.update_layout(
                **plotly_dark(height=420),
                title=dict(
                    text=f"Top {top_n} Feature Contributions — {target.capitalize()} (predicted: {state_label.title()})",
                    font=dict(size=12),
                ),
                xaxis_title="SHAP Value  (red = toward fault, blue = away from fault)",
                yaxis_title="",
                bargap=0.2,
            )
            st.plotly_chart(fig_wf, use_container_width=True)

            # Plain-English explanation
            top3_names = top_names[:3]
            top3_vals_shap = top_vals[:3]
            top3_feat_vals = top_feat_vals[:3]

            total_abs = np.sum(np.abs(shap_vals))
            top3_pct = (np.sum(np.abs(top_vals[:3])) / (total_abs + 1e-9)) * 100

            direction_words = []
            for n, sv, fv in zip(top3_names, top3_vals_shap, top3_feat_vals):
                direction = "elevated" if sv > 0 else "suppressed"
                direction_words.append(f"**{n}** (value: {fv:.3f}, contribution: {sv:+.4f} — {direction})")

            explanation = (
                f"The model predicted **{target}** as *{state_label}* (confidence {confidence:.1f}%) "
                f"primarily driven by {direction_words[0]}. "
                f"Additionally, {direction_words[1]} further reinforced this prediction, "
                f"while {direction_words[2]} also contributed. "
                f"These top 3 features account for **{top3_pct:.0f}%** of the model's total explanation "
                f"for this cycle — all recommendations require engineer sign-off before action."
            )

            st.markdown(f"""
            <div class="success-box">
            <strong>Plain-English Explanation:</strong><br><br>
            {explanation}
            </div>
            """, unsafe_allow_html=True)

            # Global SHAP importance
            st.markdown(f'<div class="section-header">Global Feature Importance — {target.capitalize()} (All Test Cycles)</div>', unsafe_allow_html=True)

            global_imp = shap_importance[["feature", target]].sort_values(target, ascending=False).head(15)
            fig_glob = go.Figure(go.Bar(
                x=global_imp[target],
                y=global_imp["feature"],
                orientation="h",
                marker_color=C_PURPLE,
                hovertemplate="%{y}: %{x:.4f}<extra></extra>",
            ))
            fig_glob.update_layout(
                **plotly_dark(height=350),
                title=dict(text=f"Mean |SHAP| — Top 15 Features for {target.capitalize()}", font=dict(size=12)),
                xaxis_title="Mean |SHAP| Value",
                yaxis=dict(autorange="reversed"),
            )
            st.plotly_chart(fig_glob, use_container_width=True)

    render_footer()


# ─────────────────────────────────────────────
# PAGE 4: MODEL PERFORMANCE
# ─────────────────────────────────────────────
def page_performance(data):
    render_header("Model Performance")

    results = data["results"]
    y_test = data["y_test"]
    y_pred = data["y_pred"]
    label_maps = data["label_maps"]

    # ── Model comparison table ────────────────────────────────────
    st.markdown('<div class="section-header">Model Comparison — Macro F1 Score</div>', unsafe_allow_html=True)

    model_names = list(results["models"].keys())
    rows = []
    for mn in model_names:
        row = {"Model": mn}
        per = results["models"][mn]["per_target"]
        for t in TARGETS:
            row[t.capitalize()] = per[t]["macro_f1"]
        row["Mean F1"] = results["models"][mn]["mean_macro_f1"]
        rows.append(row)

    df_models = pd.DataFrame(rows)

    def highlight_best(col):
        if col.name == "Model":
            return [""] * len(col)
        is_max = col == col.max()
        return [f"background-color: rgba(127,119,221,0.25); color: {C_TEXT}" if m else "" for m in is_max]

    styled = df_models.style.apply(highlight_best).format(
        {t.capitalize(): "{:.4f}" for t in TARGETS} | {"Mean F1": "{:.4f}"}
    )
    st.dataframe(styled, use_container_width=True, hide_index=True)

    st.markdown("""
    <div class="info-box">
    <strong>Why Macro F1?</strong> With multiple health classes, macro F1 weights all states equally.
    A model that only predicts "healthy" would score poorly despite high accuracy — macro F1 penalises
    this and ensures rare fault states are predicted correctly.
    </div>
    """, unsafe_allow_html=True)

    # ── CV results ────────────────────────────────────────────────
    st.markdown('<div class="section-header">5-Fold Cross-Validation — XGBoost Tuned</div>', unsafe_allow_html=True)

    cv = results["cv_results"]
    fig_cv = go.Figure()
    for t in TARGETS:
        folds = cv[t]["folds"]
        mean_v = cv[t]["mean"]
        std_v = cv[t]["std"]
        fig_cv.add_trace(go.Bar(
            name=t.capitalize(),
            x=[f"Fold {i+1}" for i in range(len(folds))],
            y=folds,
            text=[f"{v:.4f}" for v in folds],
            textposition="outside",
            hovertemplate=f"{t.capitalize()}: %{{y:.4f}}<extra></extra>",
        ))

    fig_cv.update_layout(
        **plotly_dark(height=350),
        title=dict(text="Cross-Validation F1 per Fold per Target", font=dict(size=12)),
        barmode="group",
        yaxis=dict(range=[0.93, 1.01], title="Macro F1"),
        legend=dict(x=0.01, y=0.01),
    )
    st.plotly_chart(fig_cv, use_container_width=True)

    # CV summary metrics
    c_cols = st.columns(4)
    for col, t in zip(c_cols, TARGETS):
        with col:
            st.metric(
                label=f"{TARGET_ICONS[t]} {t.capitalize()}",
                value=f"{cv[t]['mean']:.4f}",
                delta=f"± {cv[t]['std']:.4f} std",
            )

    # ── Confusion matrices ────────────────────────────────────────
    st.markdown('<div class="section-header">Confusion Matrices — Test Set</div>', unsafe_allow_html=True)

    fig_cm = make_subplots(
        rows=1, cols=4,
        subplot_titles=[t.capitalize() for t in TARGETS],
        horizontal_spacing=0.08,
    )

    for col_i, target in enumerate(TARGETS, 1):
        true_vals = y_test[target].values
        pred_vals = y_pred[target].values
        classes = sorted(list(set(true_vals) | set(pred_vals)))
        class_labels = [get_class_label(target, c, label_maps).replace(" ", "<br>") for c in classes]

        cm = confusion_matrix(true_vals, pred_vals, labels=classes)
        cm_norm = cm.astype(float) / (cm.sum(axis=1, keepdims=True) + 1e-9)

        text_vals = [
            [f"{cm[i][j]}<br>({cm_norm[i][j]*100:.0f}%)" for j in range(len(classes))]
            for i in range(len(classes))
        ]

        fig_cm.add_trace(
            go.Heatmap(
                z=cm_norm,
                x=class_labels,
                y=class_labels,
                text=text_vals,
                texttemplate="%{text}",
                colorscale=[[0, C_CARD], [1, C_PURPLE]],
                showscale=False,
                hovertemplate="True: %{y}<br>Pred: %{x}<br>%{text}<extra></extra>",
            ),
            row=1, col=col_i,
        )

    fig_cm.update_layout(
        **plotly_dark(height=320),
        title=dict(text="Row-normalised Confusion Matrices (count + %)", font=dict(size=12)),
    )
    st.plotly_chart(fig_cm, use_container_width=True)

    # ── Classification report ─────────────────────────────────────
    with st.expander("📋 Full Classification Report per Target"):
        for target in TARGETS:
            st.markdown(f"**{TARGET_ICONS[target]} {target.capitalize()}**")
            true_vals = y_test[target].values
            pred_vals = y_pred[target].values
            classes = sorted(list(set(true_vals) | set(pred_vals)))
            class_labels = [get_class_label(target, c, label_maps) for c in classes]
            report = classification_report(true_vals, pred_vals, labels=classes,
                                           target_names=class_labels, output_dict=True)
            report_df = pd.DataFrame(report).T.drop(
                columns=["support"], errors="ignore"
            ).round(4)
            st.dataframe(report_df, use_container_width=True)
            st.markdown("---")

    render_footer()


# ─────────────────────────────────────────────
# PAGE 5: BUSINESS CASE
# ─────────────────────────────────────────────
def page_business(data):
    render_header("Business Case")

    results = data["results"]
    # Derive model catch rate from mean tuned accuracy across targets
    catch_rate = (
        results["models"]["XGBoost (tuned)"]["per_target"]["cooler"]["accuracy"]
        + results["models"]["XGBoost (tuned)"]["per_target"]["valve"]["accuracy"]
        + results["models"]["XGBoost (tuned)"]["per_target"]["pump"]["accuracy"]
        + results["models"]["XGBoost (tuned)"]["per_target"]["accumulator"]["accuracy"]
    ) / 4

    # ── Cost savings calculator ───────────────────────────────────
    st.markdown('<div class="section-header">Cost Savings Calculator</div>', unsafe_allow_html=True)

    c1, c2, c3 = st.columns(3)
    with c1:
        n_pumps = st.slider("Hydraulic systems in plant", 1, 200, 50)
        failures_per_year = st.slider("Failures per system per year (without AI)", 0.5, 10.0, 2.5, 0.5)
    with c2:
        cost_per_hour = st.number_input("Downtime cost per failure (£/hr)", 1000, 100000, 15000, 1000)
        downtime_hours = st.slider("Average downtime per failure (hrs)", 1, 48, 8)
    with c3:
        st.metric("AI Catch Rate", f"{catch_rate*100:.1f}%", help="Derived from model accuracy on held-out test set")
        st.metric("Model", "XGBoost (Tuned)", help="Best performing model on this dataset")
        st.metric("Training Cycles", "1,159  (80/20 split)")

    # Calculations
    total_failures_no_ai = n_pumps * failures_per_year
    failures_caught = total_failures_no_ai * catch_rate
    downtime_saved = failures_caught * downtime_hours
    cost_saved = downtime_saved * cost_per_hour
    engineer_salary = 45_000
    roi_engineers = cost_saved / engineer_salary

    st.markdown("<br>", unsafe_allow_html=True)

    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.metric("Failures Prevented / Year", f"{failures_caught:.0f}",
                  delta=f"of {total_failures_no_ai:.0f} total")
    with m2:
        st.metric("Downtime Hours Avoided / Year", f"{downtime_saved:,.0f} hrs")
    with m3:
        st.metric("Estimated Annual Saving", f"£{cost_saved:,.0f}",
                  delta=f"@ £{cost_per_hour:,}/hr")
    with m4:
        st.metric("ROI Equivalent", f"{roi_engineers:.1f}× engineer salary",
                  delta=f"@ £{engineer_salary:,} / yr baseline")

    # Animated bar showing breakdown
    fig_cost = go.Figure()
    categories = ["Failures\nPrevented", "Downtime\nAvoided (hrs)", "Cost Saved\n(£ thousands)"]
    values = [failures_caught, downtime_saved, cost_saved / 1000]
    colors = [C_GREEN, C_BLUE, C_PURPLE]

    for cat, val, col in zip(categories, values, colors):
        fig_cost.add_trace(go.Bar(
            x=[cat], y=[val], marker_color=col,
            text=[f"{val:,.1f}"],
            textposition="outside",
            name=cat,
            showlegend=False,
        ))

    fig_cost.update_layout(
        **plotly_dark(height=260),
        title=dict(text="Annual Impact Summary", font=dict(size=12)),
        yaxis_title="Value",
        bargap=0.4,
    )
    st.plotly_chart(fig_cost, use_container_width=True)

    # ── I5.0 principles ───────────────────────────────────────────
    st.markdown('<div class="section-header">Industry 5.0 Principles</div>', unsafe_allow_html=True)

    p1, p2, p3 = st.columns(3)
    principles = [
        ("🤝", "Human-Centricity",
         "Engineers remain in the loop at every stage. HydroSense AI surfaces anomalies "
         "and ranks risk, but every maintenance action requires human authorisation. "
         "The dashboard is designed to be understood by both engineers and managers — "
         "no AI black box."),
        ("🌱", "Sustainability",
         "Preventing unplanned failures eliminates emergency part replacements, reduces "
         "hazardous fluid spills, and cuts energy wasted through degraded components. "
         "Predictive maintenance directly lowers the plant's environmental footprint "
         "and supports net-zero operational targets."),
        ("💪", "Resilience",
         "By detecting faults weeks before failure, plants avoid supply-chain disruption, "
         "regulatory shutdown risk, and catastrophic process contamination. This system "
         "increases Mean Time Between Failures (MTBF) and supports the EU's goal of "
         "a resilient, shock-resistant industrial base."),
    ]

    for col, (icon, title, body) in zip([p1, p2, p3], principles):
        with col:
            st.markdown(
                f"<div style='background:{C_CARD};border:1px solid {C_BORDER};border-radius:14px;"
                f"padding:22px;height:100%;box-shadow:0 2px 10px rgba(0,0,0,0.06)'>"
                f"<div style='font-size:2rem'>{icon}</div>"
                f"<div style='font-size:1rem;font-weight:700;color:{C_TEXT};margin:10px 0 8px'>{title}</div>"
                f"<div style='font-size:0.82rem;color:{C_TEXT3};line-height:1.6'>{body}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )

    # ── Chemical industry context ──────────────────────────────────
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="section-header">Why This Matters for Chemical Plants</div>', unsafe_allow_html=True)
    st.markdown("""
    <div class="warn-box">
    <strong>Chemical plant context:</strong> Hydraulic systems in chemical processing facilities
    operate under extreme pressures, corrosive media, and strict regulatory environments (COMAH,
    ATEX, DSEAR). A single unplanned failure can trigger process contamination, hazardous fluid
    release, or a regulatory shutdown — costs that dwarf routine maintenance budgets. Unlike
    automotive or consumer applications, the consequences of component failure here are
    safety-critical: injury, environmental liability, and production loss in a single event can
    exceed £1 million. Predictive maintenance at this site is not a cost-saving exercise —
    it is a <strong>safety imperative and a compliance requirement</strong>.
    HydroSense AI provides the continuous, data-driven monitoring that human inspection alone
    cannot deliver at scale, while keeping the engineer firmly in command of every decision.
    </div>
    """, unsafe_allow_html=True)

    render_footer()

#LLM page

def page_chat(data: dict, cycle_idx: int):
    """Page 6 — Engineer Assistant (LLM chat with live plant context)."""

    render_header("Engineer Assistant")

    client = get_groq_client()

    # ── API key missing — friendly setup notice ───────────────────
    if client is None:
        st.markdown(f"""
        <div class="warn-box">
        <strong>Groq API key not configured.</strong><br>
        To enable the Engineer Assistant:<br>
        1. Sign up free at <strong>groq.com</strong> — no credit card needed<br>
        2. Create an API key at <strong>console.groq.com/keys</strong><br>
        3. Add <code>GROQ_API_KEY=your-key-here</code> to your <code>.env</code> file<br>
        4. Restart the dashboard with <code>streamlit run dashboard/app.py</code>
        </div>
        """, unsafe_allow_html=True)
        render_footer()
        return

    # ── Context header ────────────────────────────────────────────
    st.markdown(
        f"<div class='info-box'>"
        f"<strong>Context:</strong> The assistant has full visibility of the current "
        f"plant status for cycle {cycle_idx} — component health states, model "
        f"confidence, SHAP feature explanations, and sensor readings. "
        f"Ask anything about what the model is seeing and why."
        f"</div>",
        unsafe_allow_html=True,
    )

    # ── Mini health cards — what we're talking about ──────────────
    st.markdown('<div class="section-header">Current Plant Status (Cycle {})</div>'.format(cycle_idx),
                unsafe_allow_html=True)
    render_health_mini_cards(data, cycle_idx)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Initialise session state ──────────────────────────────────
    # Step 4: chat history lives in session_state so it survives reruns
    if "chat_messages" not in st.session_state:
        st.session_state.chat_messages = []

    # Step 8: detect cycle change and reset conversation
    if "chat_cycle" not in st.session_state:
        st.session_state.chat_cycle = cycle_idx

    if st.session_state.chat_cycle != cycle_idx:
        st.session_state.chat_messages = []
        st.session_state.chat_cycle    = cycle_idx
        st.info(f"Context updated for cycle {cycle_idx} — conversation reset.")

    # ── Suggested questions (Step 7) ─────────────────────────────
    # Only show when chat is empty — keeps the UI clean once a conv is running
    if not st.session_state.chat_messages:
        st.markdown('<div class="section-header">Suggested Questions</div>',
                    unsafe_allow_html=True)

        # Two rows of 3 buttons
        row1 = st.columns(3)
        row2 = st.columns(3)
        btn_cols = row1 + row2

        for col, question in zip(btn_cols, SUGGESTED_QUESTIONS):
            with col:
                if st.button(
                    question,
                    use_container_width=True,
                    key=f"suggested_{question[:20]}",
                ):
                    st.session_state.chat_messages.append(
                        {"role": "user", "content": question}
                    )
                    st.rerun()

        st.markdown("<br>", unsafe_allow_html=True)

    # ── Chat history display ──────────────────────────────────────
    st.markdown('<div class="section-header">Conversation</div>',
                unsafe_allow_html=True)

    # Render all existing messages
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"],
                             avatar="🧑‍🔧" if msg["role"] == "user" else "🤖"):
            st.markdown(msg["content"])

    # ── Stream new assistant response if last message is from user ─
    # Step 6: streaming API call
    if (st.session_state.chat_messages and
            st.session_state.chat_messages[-1]["role"] == "user"):

        system_prompt = build_system_prompt(data, cycle_idx)

        with st.chat_message("assistant", avatar="🤖"):
            # Stream the response token-by-token into the chat bubble
            response_placeholder = st.empty()
            full_response        = ""

            for chunk in chat_turn(
                client,
                st.session_state.chat_messages,
                system_prompt,
            ):
                full_response += chunk
                response_placeholder.markdown(full_response + "▌")  # typing cursor

            response_placeholder.markdown(full_response)  # final render without cursor

        # Append assistant message to history
        st.session_state.chat_messages.append(
            {"role": "assistant", "content": full_response}
        )

    # ── Chat input box (Step 5) ───────────────────────────────────
    user_input = st.chat_input(
        "Ask about the plant status, sensor readings, maintenance actions..."
    )

    if user_input:
        st.session_state.chat_messages.append(
            {"role": "user", "content": user_input}
        )
        st.rerun()

    # ── Conversation controls ─────────────────────────────────────
    if st.session_state.chat_messages:
        st.markdown("<br>", unsafe_allow_html=True)
        col_clear, col_info = st.columns([1, 3])
        with col_clear:
            if st.button("🗑️  Clear conversation", use_container_width=True):
                st.session_state.chat_messages = []
                st.rerun()
        with col_info:
            st.markdown(
                f"<div style='font-size:0.78rem;color:{C_TEXT2};padding-top:8px'>"
                f"Model: <strong>Llama 3.3 70B</strong> via Groq &nbsp;|&nbsp; "
                f"Context: Cycle {cycle_idx} plant data &nbsp;|&nbsp; "
                f"All recommendations require engineer sign-off"
                f"</div>",
                unsafe_allow_html=True,
            )

    # ── I5.0 disclaimer ───────────────────────────────────────────
    st.markdown(
        f"<div style='margin-top:24px;padding:12px 16px;"
        f"background:#F8FAFC;border:1px solid {C_BORDER};"
        f"border-radius:8px;font-size:0.78rem;color:{C_TEXT2};line-height:1.6'>"
        f"<strong style='color:{C_TEXT}'>Industry 5.0 Principle:</strong> "
        f"This assistant surfaces AI-generated insights to support engineering "
        f"decision-making. It does not have access to real-time sensor feeds, "
        f"plant schematics, or maintenance records beyond what is shown in this "
        f"dashboard. All maintenance decisions and actions remain the sole "
        f"responsibility of the qualified engineer on site."
        f"</div>",
        unsafe_allow_html=True,
    )

    render_footer()



# ─────────────────────────────────────────────
# SIDEBAR + ROUTING
# ─────────────────────────────────────────────
def main():
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

    with st.spinner("Loading HydroSense AI data…"):
        data = load_all_data()

    n_cycles = len(data["X_test"])

    with st.sidebar:
        st.markdown(
            f"<div style='text-align:center;padding:16px 0 8px'>"
            f"<div style='font-size:1.3rem;font-weight:700;color:{C_TEXT}'>⚙️ HydroSense AI</div>"
            f"<div style='font-size:0.7rem;color:{C_TEXT2}'>Industry 5.0 Plant Monitor</div>"
            f"</div>",
            unsafe_allow_html=True,
        )
        st.divider()

        st.markdown('<div class="sidebar-section">Navigation</div>', unsafe_allow_html=True)
        page = st.radio(
            "Page",
            ["🏭  Plant Overview", "📡  Sensor Intelligence",
             "🧠  AI Explanation", "📊  Model Performance", "💼  Business Case", "Engineer Assistant"],
            label_visibility="collapsed",
        )

        st.divider()
        st.markdown('<div class="sidebar-section">Cycle Selector</div>', unsafe_allow_html=True)
        cycle_idx = st.slider(
            "Test cycle index",
            0, n_cycles - 1, 0,
            help=f"Select any of the {n_cycles} held-out test cycles",
        )

        # Quick status for selected cycle
        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown('<div class="sidebar-section">Selected Cycle Health</div>', unsafe_allow_html=True)
        for t in TARGETS:
            pred_cls = int(data["y_pred"].iloc[cycle_idx][t])
            lbl, color, _ = health_status(t, pred_cls)
            state = data["label_maps"]["label_decodings"][t][str(pred_cls)]
            st.markdown(
                f"<div style='display:flex;align-items:center;gap:8px;margin:4px 0'>"
                f"<span>{TARGET_ICONS[t]}</span>"
                f"<span style='font-size:0.75rem;color:{C_TEXT3};flex:1'>{t.capitalize()}</span>"
                f"<span style='font-size:0.7rem;color:{color};font-weight:600'>{lbl.split()[0]}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )

        st.divider()
        st.markdown(
            f"<div style='font-size:0.7rem;color:{C_TEXT2};line-height:1.5'>"
            f"Test set: {n_cycles} cycles<br>"
            f"Features: {data['X_test'].shape[1]}<br>"
            f"Model: XGBoost (tuned)<br>"
            f"Dataset: UCI Hydraulic System"
            f"</div>",
            unsafe_allow_html=True,
        )

    # Route
    if "Plant Overview" in page:
        page_overview(data, cycle_idx)
    elif "Sensor Intelligence" in page:
        page_sensors(data, cycle_idx)
    elif "AI Explanation" in page:
        page_shap(data, cycle_idx)
    elif "Model Performance" in page:
        page_performance(data)
    elif "Business Case" in page:
        page_business(data)
    elif "Engineer Assistant" in page:
        page_chat(data, cycle_idx)      


if __name__ == "__main__":
    main()
