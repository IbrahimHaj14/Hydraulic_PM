# HydroSense AI — Hydraulic Condition Monitoring
**WM9QC-15 Artificial Intelligence for Industry | WMG, University of Warwick**

AI-driven condition monitoring system for hydraulic systems in chemical plant environments. Classifies the health state of four hydraulic components using an XGBoost multi-output classifier, with SHAP explainability and an LLM-powered engineer assistant.

---

## Dataset

[UCI Hydraulic Systems Condition Monitoring](https://archive.ics.uci.edu/dataset/447/condition+monitoring+of+hydraulic+systems) — download and place the `.txt` files in `data/raw/`.

---

## Setup

```bash
git clone https://github.com/your-username/hydraulic-condition-monitoring.git
cd hydraulic-condition-monitoring

python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your Groq API key (free at console.groq.com)
```

---

## Run the notebooks

```bash
jupyter notebook
```

Run them in order:

| Notebook | What it does |
|---|---|
| `notebooks/02_data_loading_cleaning.ipynb` | Load raw sensor files, filter unstable cycles, encode labels |
| `notebooks/03_feature_engineering.ipynb` | Extract 211 features (time-domain, frequency, cross-sensor) |
| `notebooks/04_modelling.ipynb` | Train XGBoost, Random Forest, Logistic Regression — compare with 5-fold CV |
| `notebooks/05_shap_explainability (2).ipynb` | SHAP beeswarm, waterfall, and feature group contribution plots |

---

## Run the dashboard

```bash
cd enterprise-dashboard
npm install
npm run dev
```

Opens at `http://localhost:3000`

| Page | Description |
|---|---|
| Plant Overview | 4-component health cards with traffic-light status and recommendations |
| Sensor Intelligence | Raw signal viewer and sensor statistics per cycle |
| AI Explanation | SHAP waterfall — why was this component flagged? |
| Model Performance | Confusion matrices, F1 scores, model comparison |
| Business Case | Cost saving calculator and Industry 5.0 principles |
| Engineer Assistant | LLM chat with live plant context (requires Groq key) |

---

## Project structure

```
├── data/
│   ├── raw/                    ← UCI .txt sensor files (not committed)
│   └── processed/              ← cleaned features, labels, SHAP values
├── models/                     ← trained XGBoost model and results
├── notebooks/                  ← phases 2–5
├── enterprise-dashboard/       ← Next.js dashboard
├── requirements.txt
└── README.md
```

---

## Results

| Model | Mean Macro F1 (test) |
|---|---|
| Logistic Regression | 0.972 |
| Random Forest | 0.996 |
| XGBoost (tuned) | 0.986 |
| **XGBoost (5-fold CV)** | **0.991** |

---
