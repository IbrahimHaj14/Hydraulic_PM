# HydroSense AI — Hydraulic Condition Monitoring
**WM9QC-15 Artificial Intelligence for Industry | WMG, University of Warwick**
 
AI-driven condition monitoring system for hydraulic systems in chemical plant environments. Classifies the health state of four hydraulic components in real time using an XGBoost multi-output classifier, with SHAP explainability and an LLM-powered engineer assistant. Built as an Industry 5.0 human-AI collaboration demo.
 
---
 
## Dataset
 
[UCI Hydraulic Systems Condition Monitoring](https://archive.ics.uci.edu/dataset/447/condition+monitoring+of+hydraulic+systems) — download and place the `.txt` files in `data/raw/`.
 
---
 
## Setup
 
```bash
# Clone the repo
git clone https://github.com/your-username/hydraulic-condition-monitoring.git
cd hydraulic-condition-monitoring
 
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
 
# Install dependencies
pip install -r requirements.txt
 
# Add your Groq API key (free at console.groq.com)
cp .env.example .env
# Edit .env and paste your key
```
 
---
 
## Run the notebooks in order
 
```bash
jupyter notebook
```
 
| Notebook | Description |
|---|---|
| `notebooks/02_data_loading_cleaning.ipynb` | Load raw sensor files, filter unstable cycles, encode labels |
| `notebooks/03_feature_engineering.ipynb` | Extract 211 features (time-domain, frequency, cross-sensor) |
| `notebooks/04_modelling.ipynb` | Train XGBoost, Random Forest, Logistic Regression — compare with 5-fold CV |
| `notebooks/05_shap_explainability.ipynb` | SHAP beeswarm, waterfall, and feature group contribution plots |
 
---
 
## Run the dashboard
 
```bash
streamlit run dashboard/app.py
```
 
Opens at `http://localhost:8501`
 
| Page | Description |
|---|---|
| 🏭 Plant Overview | 4-component health cards with traffic-light status and recommendations |
| 📡 Sensor Intelligence | Raw signal viewer and sensor statistics per cycle |
| 🧠 AI Explanation | SHAP waterfall — why was this component flagged? |
| 📊 Model Performance | Confusion matrices, F1 scores, model comparison |
| 💼 Business Case | Cost saving calculator and Industry 5.0 principles |
| 🤖 Engineer Assistant | LLM chat with live plant context (requires Groq key) |
 
---
 
## Project structure
 
```
├── data/
│   ├── raw/               ← UCI .txt sensor files (not committed)
│   ├── processed/         ← cleaned features, labels, SHAP values
│   └── shap/
├── models/                ← trained XGBoost model
├── notebooks/             ← phases 2–5
├── dashboard/
│   └── app.py             ← Streamlit dashboard
├── .env.example
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
