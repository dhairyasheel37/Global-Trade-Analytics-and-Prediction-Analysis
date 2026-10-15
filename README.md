# Global Trade Analytics and Prediction Analysis

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-153%20Passed-10b981?style=flat&logo=pytest&logoColor=white)](backend/tests/)

An enterprise-grade macroeconomic merchandise trade analytics and predictive intelligence platform built with **FastAPI**, **React 19**, and **UN Comtrade data**. Features formalized international trade indices, geospatial choropleth vector mapping, machine learning trade forecasting (2026–2030), executive PDF/Excel reporting engines, automated UN Comtrade live API synchronization, and econometric what-if scenario simulations.

---

## 🌟 Key Platform Modules

### 1. Executive Dashboard & Macro KPIs
- Real-time global trade aggregates across 190 sovereign nations (2014–2025).
- Worldwide trade turnover, leading exporters, top import markets, and trade balance equilibrium.
- Interactive historical trends, top trading partner bar charts, and dynamic temporal filters.

### 2. Interactive Geospatial Trade Map
- Full offline **D3 / TopoJSON vector choropleth map** rendering 190 sovereign economies.
- Real-time trade balance classification: Surplus Powerhouse, Balanced Partner, or Net Importer.
- Interactive slide-out **Country Dossier Drawer** displaying top 5 bilateral export destinations, import sources, and historical growth trajectories.

### 3. Bilateral Trade Flow Analysis
- Deep-dive directional trade breakdown ($Exports$, $Imports$, $Net Balance$).
- Dynamic reporter-partner bilateral flow analysis with server-side sorting, pagination, and CSV export.

### 4. Country Profile & Comparative Analysis
- Detailed national economic profile with zero-guarded growth rates and historical trade trends.
- Side-by-side **Country Comparison Matrix** with comparative volume disparities and balance gap analysis.

### 5. Product & Commodity Analysis
- In-depth commodity analysis across Harmonized System (HS) chapters.
- Sectoral export/import market share distribution and leading commodity supplier rankings.

### 6. Machine Learning Forecasting Engine
- **Recursive Multi-Step Forecasting** projecting bilateral trade turnover for 1–5 future years (2026–2030).
- Leakage-free lag feature engineering (`lag_1`, `lag_2`, `lag_3`, rolling averages).
- Dual model evaluation: **Linear Regression** (Parametric Trend) and **Random Forest Regressor** (50-tree ensemble).
- Automatic model selection with 95% parametric confidence interval bounds ($\hat{y} \pm 1.96 \cdot \text{SE} \cdot \sqrt{h}$) and baseline MAE benchmark guards.

### 7. Specialized Trade Economic Indices
- **Lafay Trade Balance Index (TBI)**: Normalized scale-invariant trade balance measure $[-100, +100]$.
- **Revealed Trade Advantage (RTA / Macro Balassa)**: Normalized relative export specialization ratio.
- **Grubel-Lloyd Trade Overlap Index (GLI)**: Intra-industry macro trade overlap $[0.0, 1.0]$.
- **Hirschman-Herfindahl Index (HHI)**: Global export market concentration and diversification benchmark.
- **Interactive Multi-Year Heatmaps**: 2D Countries $\times$ Years grid with floating glassmorphism cell inspection tooltips, visual export-import ratio split bars, and crosshair highlighting.
- **Cross-Country Synchronization Matrix**: Pairwise Pearson correlation coefficients $r \in [-1.0, +1.0]$ across national trade cycles.

### 8. Executive Reporting Engine
- **PDF Briefing Dossiers**: Multi-page styled executive PDF reports with metadata headers, KPI summary tables, balance distributions, and automated pagination via ReportLab.
- **Excel Financial Models**: Professional workbooks with styled header fills, formatted currency cells, auto-fitted columns, and embedded summary statistics via OpenPyXL.

### 9. Live UN Comtrade Ingestion & Auto-Sync
- **Automated Data Fetcher**: Resilient client querying UN Comtrade v1 REST API with rate-limiting and dynamic M49 reference metadata caching.
- **Scheduled Background Cron**: Asynchronous background worker in FastAPI lifespan executing validation, cleaning, deduplication, and database indexing.
- **Drag-and-Drop Ingestion Portal**: Glassmorphic drag-and-drop dropzone on `/data-management` with instant schema checking and historical audit trail logging.

### 10. Scenario Simulator & Tariff Impact Engine ("What-If" Analysis)
- **Armington Elasticity Model**: Models price pass-through and quantity demand responses ($\% \Delta Q = \epsilon_d \times \tau$) with bounded logarithmic safeguards.
- **Curated Geopolitical Presets**: 1-click policy scenarios including US-China Section 301 (+25%), Global Tech Slump (-15%), EU Carbon Border Levy (+12%), and Indo-US Liberalization (-10%).
- **Interactive Shock Controls**: Real-time ad-valorem tariff sliders ($-30\%$ to $+75\%$), macro demand shift sliders, and customizable sector price elasticities.
- **Dynamic Recharts Visualizations**: Multi-year baseline vs. shock trajectory projections, third-party trade diversion beneficiary rankings, and Laffer-style tariff vs. revenue sensitivity curves.
- **Automated Policy Briefings**: Real-time narrative synthesis explaining consumer cost absorption, fiscal customs yields, and trade balance shifts with 1-click CSV/JSON export.

---

## 🛠️ Architecture & Tech Stack

```
trade-system/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI REST endpoints
│   │   ├── database/       # SQLAlchemy models, sessions, migrations
│   │   ├── ml/             # Scikit-learn feature pipeline & prediction engine
│   │   ├── reporting/      # ReportLab PDF & OpenPyXL Excel generators
│   │   ├── scripts/        # Data collection & verification utilities
│   │   ├── utils/          # Authentication (bcrypt + JWT), logging, formatters
│   │   ├── config.py       # Application configurations
│   │   └── main.py         # FastAPI application factory & middleware
│   ├── tests/              # 138 Pytest unit & integration tests
│   ├── requirements.txt    # Python dependencies
│   └── run.py              # Server launcher CLI
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API client with auth interceptors
│   │   ├── components/     # Layout, Sidebar, Modals, Geo Map, Tooltips
│   │   ├── context/        # React Authentication context
│   │   ├── pages/          # 11 interactive module pages
│   │   ├── App.jsx         # Client-side routing with role-based protection
│   │   └── main.jsx        # React root entrypoint
│   ├── package.json        # Frontend dependencies (React 19, Recharts, Lucide)
│   └── vite.config.js      # Vite build configuration
├── data/
│   ├── raw/                # UN Comtrade raw CSV archives
│   └── trade_data.db       # Primary SQLite relational database (4,877 verified records)
├── docs/
│   └── screenshots/        # Verified platform interface screenshots
└── walkthrough.md          # Comprehensive 14-phase development walkthrough
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.12 or higher
- **Node.js**: 20 or higher
- **Git**

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI backend server
python run.py --host 127.0.0.1 --port 8000 --reload
```

The interactive Swagger API documentation will be available at:
👉 **`http://localhost:8000/docs`**

---

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Launch Vite development server
npm run dev
```

The web application will be live at:
👉 **`http://localhost:5173`**

---

### 3. Default Login Credentials

| Role | Username | Password |
| :--- | :--- | :--- |
| **System Administrator** | `admin` | `Admin@Trade2026!` |
| **Trade Analyst** | `trader` | `Trader@Trade2026!` |

---

## 🧪 Running the Test Suite

The backend includes a comprehensive 145-test verification suite covering authentication, API endpoints, data pipelines, regression guards, ML prediction models, economic indices, and UN Comtrade live synchronization.

```bash
cd backend
python -m pytest -v
```

**Result:** `145 passed in ~35s (100% pass rate)`

---

## 👤 Author

**Dhairyasheel Gaikwad**
- GitHub: [@dhairyasheel37](https://github.com/dhairyasheel37)
- Email: [dhairyasheelgaikwad8@gmail.com](mailto:dhairyasheelgaikwad8@gmail.com)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
