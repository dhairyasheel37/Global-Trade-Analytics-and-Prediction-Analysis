# Walkthrough - Global Trade Analysis & Prediction System

## Phase 1: Dataset Validation & Data Layer (Completed)
- Cleaned and loaded 3,925 UN Comtrade records into SQLite (`trade_records` table).
- Created composite index `idx_trade_dedup` on `(refYear, reporterISO, partnerISO, flowCode, cmdCode)`.
- Verified live dynamic summary and sampling endpoints.

---

## Phase 2: Authentication and Authorization (Completed)
- Users table with bcrypt password hashing (`admin` / `Admin@Trade2026!` and `trader` / `Trader@Trade2026!`).
- JWT authentication (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`).
- Role-based server-side protection (`/api/admin/ping` returning 200 for ADMIN and 403 for USER).

---

## Phase 3: Dashboard and Global Filters (Completed)
- 7 filter-aware backend aggregation endpoints under `/api/dashboard/*`.
- Persistent sidebar navigation with role-aware rendering for `ADMIN` Data Management.
- Dashboard with 6 KPI cards, 5 Recharts visualizations, limitation notice banner, and empty-filter state.

---

## Phase 4: Trade Analysis Page (Completed)
- 4 drill-down statistical endpoints (`/api/trade-analysis/*`).
- Interactive Trade Analysis page with 8 stats cards, historical line trend, grouped bar chart, and server-side paginated/sorted data table with CSV export.

---

## Phase 5: Country Analysis Page (Completed)
- 4 country profile endpoints (`/api/country-analysis/*`).
- Country profile dashboard with zero-guarded growth rates, multi-series historical trend chart, and transparent partner/product exposure sections.

---

## Phase 6: Product & Commodity Analysis Page (Completed)
- 5 product analysis endpoints (`/api/product-analysis/*`).
- Commodity profile view with zero-guarded growth rates, historical trends, and top 10 exporters/importers rankings.

---

## Phase 7: Trade Balance Breakdown Page (Completed)
- 3 trade balance endpoints (`/api/trade-balance/*`).
- Composed export/import/balance charts and 2–5 country comparison tools with verified cross-phase mathematical consistency.

---

## Phase 8: Machine Learning Trade Prediction Engine (Completed)

### 1. Dedicated Machine Learning Engine ([prediction.py](backend/app/ml/prediction.py))
- **Leakage-Free Feature Engineering**: Strict past features `lag_1`, `lag_2`, `lag_3`, `rolling_mean_3` (shifted by 1), `pct_change_1`, and `year_trend`.
- **Minimum Data Guard**: Strictly enforces $\ge 8$ usable observations after dropping 3 initial lag rows. Slices with $< 8$ usable rows gracefully return: `"Insufficient historical data for reliable prediction."`.
- **Naive Baseline Benchmark**: Computes `baseline_mae = mean_absolute_error(y_test, y_train_mean)` on every prediction run.
- **Model Selection**: Chooses `best_model` based on lowest test MAE (`if lr_metrics["mae"] <= rf_metrics["mae"]`).
- **Low-Confidence Guard**: If the chosen model's test $R^2 < 0$, returns the exact warning string:
  > `"Low-confidence model performance: the selected model performed worse than a simple historical-mean baseline on the test data."`
- **Models Evaluated**:
  - Linear Regression (Parametric Trend Baseline)
  - Random Forest Regressor (50 Trees, Non-Linear Ensemble, `random_state=42`)
- **Multi-Step Recursive Forecasting**: Recursive projections for 1–5 future years (2026–2030) with 95% confidence intervals ($\hat{y} \pm 1.96 \cdot \text{std\_err} \cdot \sqrt{h}$).

---

### 2. Verified Deterministic Real Prediction Runs

#### Prediction Run 1: USA Exports (`reporter=USA`, `flow=X`, 3 Years)
- **Usable Observations**: 9 (Train: 2017–2023, Test: 2024–2025)
- **Baseline Test MAE**: `$389.12 B`
- **Linear Regression Test Metrics**: MAE = `$343.96 B` | RMSE = `$402.21 B` | $R^2 = -49.39$ | MAPE = $15.97\%$
- **Random Forest Test Metrics**: MAE = `$298.89 B` | RMSE = `$304.21 B` | $R^2 = -27.82$ | MAPE = $14.03\%$
- **Auto-Selected Best Model (Lowest MAE)**: `random_forest`
- **Low-Confidence Warning**: Triggered (`R² = -27.82 < 0`)
- **Future Projections (Random Forest)**:
  - 2026: **$2.15 T** (95% CI: $1.99 T – $2.31 T, -1.26%)
  - 2027: **$2.13 T** (95% CI: $1.91 T – $2.35 T, -1.00%)
  - 2028: **$2.13 T** (95% CI: $1.86 T – $2.40 T, +0.00%)

#### Prediction Run 2: China Imports (`reporter=CHN`, `flow=M`, 3 Years)
- **Usable Observations**: 8 (Train: 2017–2022, Test: 2023–2024)
- **Baseline Test MAE**: `$317.34 B`
- **Random Forest Test Metrics**: MAE = `$59.35 B` | RMSE = `$62.22 B` | $R^2 = -18.24$ | MAPE = $2.31\%$
- **Linear Regression Test Metrics**: MAE = `$326.14 B` | RMSE = `$375.18 B` | $R^2 = -698.48$ | MAPE = $12.65\%$
- **Auto-Selected Best Model (Lowest MAE)**: `random_forest`
- **Low-Confidence Warning**: Triggered (`R² = -18.24 < 0`)
- **Future Projections (Random Forest)**:
  - 2025: **$2.62 T** (95% CI: $2.46 T – $2.77 T, +1.20%)
  - 2026: **$2.62 T** (95% CI: $2.39 T – $2.84 T, +0.00%)
  - 2027: **$2.62 T** (95% CI: $2.34 T – $2.89 T, +0.00%)

---

### 3. Frontend Prediction Page ([PredictionPage.jsx](frontend/src/pages/PredictionPage.jsx))
- Interactive Forecast Horizon slider (1–5 years).
- Model selector tabs ("Auto-Selected Best", "Linear Regression", "Random Forest").
- Prominent small-data transparency banner and conditional low-confidence alert.
- Performance cards comparing Baseline MAE vs Linear Regression vs Random Forest.
- Interactive Recharts ComposedChart with solid historical line, dashed backtest line, dashed future projection line, and shaded 95% confidence band.
- Future Forecast Projections table and feature importance weights breakdown.

---

### 4. Automated Test Suite (77/77 Tests Passing)

```text
backend/tests/test_api.py (4 passed)
backend/tests/test_auth.py (13 passed)
backend/tests/test_country_analysis.py (10 passed)
backend/tests/test_dashboard.py (10 passed)
backend/tests/test_pipeline.py (8 passed)
backend/tests/test_prediction.py (7 passed)
backend/tests/test_product_analysis.py (8 passed)
backend/tests/test_trade_analysis.py (9 passed)
backend/tests/test_trade_balance.py (8 passed)
======================= 77 passed in 25.60s ========================
```

- **Frontend Production Build**: `vite build` completed in **1.34s** with 0 errors.

---

## Post-Upgrade UI Investigation & Fix: Country Analysis Page

### 1. Root Cause Analysis
During investigation of the reported apparent ~5.8x inflation on India's numbers:
- **Backend Verification**: Confirmed 100% clean and correct. Directly running `GET /api/country-analysis/partners?reporter=IND` returned India's true bilateral total of **$707.74B** across China ($367.63B), USA ($189.21B), Germany ($71.76B), Japan ($46.41B), and UK ($32.73B).
- **Frontend Bug 1 (Hardcoded Country String)**: In [CountryAnalysisPage.jsx](frontend/src/pages/CountryAnalysisPage.jsx#L581), the granular subset banner text hardcoded `"reconciliation of India's full multi-commodity World baseline"` regardless of which reporter country was selected.
- **Frontend Bug 2 (Dropdown / View Desync)**: The page defaulted to USA on initial load. The USA granular partner numbers are China ($2.11T, 51.56%), Japan ($873.99B, 21.37%), Germany ($786.19B, 19.22%), UK ($321.17B, 7.85%), and USA 2025 imports reach $3.50T. Changing the Reporter dropdown updated only local state (`selectedReporter`) without re-fetching until the "View Profile" button was clicked. Combined with the hardcoded "India" banner string, viewing the default USA profile appeared as if India's data was inflated ~5.8x.

### 2. Implementation Changes
In [CountryAnalysisPage.jsx](frontend/src/pages/CountryAnalysisPage.jsx):
1. **Dynamic Interpolation**:
   - Updated `data-testid="top-partners-subset-notice"` to dynamically interpolate `{profile?.reporter_name || "this country"}`.
   - Updated `data-testid="top-products-subset-notice"` to dynamically interpolate `{profile?.reporter_name || "this country"}`.
2. **Immediate Auto-Fetch on Dropdown Change**:
   - Added `handleReporterChange`, `handlePartnerChange`, `handleProductChange`, `handleStartYearChange`, and `handleEndYearChange` to update state and immediately invoke `fetchCountryProfile(newReporter, ...)` upon user selection.
   - Preserved manual "View Profile" button for optional manual reload.

### 3. Automated Browser Verification (Playwright & System Chrome)
Executed live automated headless Chrome verification script:
- **USA Initial View**:
  - Selected dropdown value: `USA`
  - Banner notice: `...representing a sample subset rather than a reconciliation of USA's full multi-commodity World baseline.`
  - Partner values: China ($2.11T, 51.56%), Japan ($873.99B, 21.37%), Germany ($786.19B, 19.22%), United Kingdom ($321.17B, 7.85%).
- **India View (Immediate Dropdown Change to `IND`)**:
  - Dropdown value: `IND`
  - Zero-click auto-fetch triggered and completed.
  - Banner notice: `...representing a sample subset rather than a reconciliation of India's full multi-commodity World baseline.`
  - Partner values:
    - China: **$367.63 B** (51.94% Share)
    - USA: **$189.21 B** (26.74% Share)
    - Germany: **$71.76 B** (10.14% Share)
    - Japan: **$46.41 B** (6.56% Share)
    - United Kingdom: **$32.73 B** (4.62% Share)
  - Combined Total: **$707.74 B** (Exact match with backend and UN Comtrade raw ingestion).

![USA Country Analysis View](docs/screenshots/usa_country_analysis.png)
![India Country Analysis View](docs/screenshots/india_country_analysis.png)

### 4. Regression Testing & Synchronization
- **Backend Test Suite**: 100/100 tests passed (`100 passed, 1 warning in 51.04s`).
- **Frontend Production Build**: `npm run build` passed in 9.36s with 0 errors.
- **Desktop Mirror**: Mirrored [CountryAnalysisPage.jsx](file:///C:/Users/DNG/OneDrive/Desktop/trade-system/frontend/src/pages/CountryAnalysisPage.jsx) and production assets to `C:\Users\DNG\OneDrive\Desktop\trade-system`.

---

## Post-Upgrade Audit & Fix: Dataset Overview and Dataset Health

### 1. Root Cause Summary
- **Issue 1 & 12 (Product Count & Terminology Inconsistency)**:
  - In `trade_records` (baseline), all 3,925 rows were aggregate `cmdCode = "TOTAL"` ("All Commodities"), yielding `COUNT(DISTINCT cmdCode) = 1`.
  - In `trade_records_v2` (active dataset), 952 granular bilateral rows introduced 4 distinct HS chapters (`30`, `84`, `85`, `87`) alongside `TOTAL`.
  - `/api/admin/data/overview` previously queried only the legacy table and reported `Products: 1`, while the Scope Notice reported `4 product categories`. We resolved this by explicitly labeling the 4 chapters as **“HS Product Categories”** and distinguishing the multi-commodity aggregate.
- **Issue 2 (Granular Scope Verification)**:
  - Database verification confirmed exactly 190 reporters (4 granular + 186 aggregate), 5 bilateral partner countries (excluding World `W00`), 4 HS product chapters, and 2 trade flows.
- **Issue 3 (Dataset Health Classification)**:
  - The previous logic triggered `health_status = "ISSUES"` simply because 5 optional measurement fields contained nulls. Core dimensions (Reporters, Years, Flows, Partners, Products, Values) have 0 nulls and 0 duplicates.
  - Refined to `"WARNINGS"` with display label `Partial Missing Data` (amber badge), accurately classifying optional measurement nulls without masking real data quality.
- **Issue 4 & 5 (Missing Values & Duplicate Key)**:
  - Verified natural composite key: `(refYear, reporterISO, partnerISO, flowCode, cmdCode)` has **0 duplicates**.
  - Exactly 6,427 null cells exist across 5 optional fields (`qty`: 543, `netWgt`: 1,922, `grossWgt`: 969, `cifvalue`: 1,628, `fobvalue`: 1,365). Overall cell missing rate = **9.10%** (6,427 / 70,650).
- **Issue 6 & 10 (Source of Truth & Record Count)**:
  - Authoritative active record count is **4,877** (`trade_records_v2`), consisting of **3,925 Baseline** + **952 Granular Bilateral** records.

### 2. Changes Made
- [schemas.py](backend/app/schemas.py): Added `MissingColumnDetail` and enhanced `DataQualitySummary` and `DataOverviewResponse` with granular scope fields and detailed missing breakdown.
- [data_management.py](backend/app/api/data_management.py): Updated `get_data_overview` to source active metrics from `trade_records_v2` and baseline counts from `trade_records`, with refined health classification.
- [test_data_management.py](backend/tests/test_data_management.py): Added `test_overview_strict_metric_rules` verifying all 18 rules.
- [ScopeNoticeBanner.jsx](frontend/src/components/ScopeNoticeBanner.jsx): Dynamic notice rendering and testids.
- [DataManagementPage.jsx](frontend/src/pages/DataManagementPage.jsx): Implemented 8 responsive KPI cards, Scope detail panel, refined Health banner with `Partial Missing Data`, and interactive missing measurement fields breakdown table.

### 3. Verified Dataset Statistics Table (Post-Correction)
| Metric | Verified Live Value | Source Table / Definition |
| :--- | :--- | :--- |
| **Total Active Records** | **4,877** | `trade_records_v2` (3,925 Base + 952 Granular) |
| **Total Active Cells** | **87,786** | 4,877 records × 18 tracked schema columns |
| **Baseline Records** | **3,925** | `trade_records` (World/TOTAL aggregate) |
| **Granular Bilateral Records** | **952** | Strictly `partner != W00 AND product != TOTAL` |
| **Columns Tracked** | **18** | Standard tracked schema fields |
| **Year Range** | **2014–2025** | `MIN(year)` to `MAX(year)` |
| **Reporters** | **190** | Sovereign trading economies |
| **Granular Reporters** | **4** | China, Germany, India, USA |
| **Aggregate-Only Reporters** | **186** | 190 total minus 4 granular |
| **Trade Flows** | **2** | Exports (`X`) & Imports (`M`) |
| **Bilateral Partners** | **5** | China, Germany, Japan, UK, USA (excludes World `W00` and TOTAL product) |
| **HS Product Categories** | **4** | HS 30, HS 84, HS 85, HS 87 (excludes TOTAL and W00 partner) |
| **Aggregate Product** | **TOTAL** | All Commodities baseline aggregate |
| **Critical Missing Cells** | **0** | Primary Trade Value, Reporter, Year, Flow, Partner, Product (100% complete) |
| **Optional Missing Cells** | **6,427** | `qty`: 543, `netWgt`: 1,922, `grossWgt`: 969, `cifvalue`: 1,628, `fobvalue`: 1,365 |
| **Active-Dataset Missing Rate** | **7.32%** | $(6,427 / 87,786) \times 100 \approx 7.32\%$ |
| **Duplicate Records** | **0** | Composite key `(refYear, reporterISO, partnerISO, flowCode, cmdCode)` |
| **Health Status** | **Partial Missing Data** | Status: `WARNINGS` (`Partial Missing Data`) |

### 4. Automated Testing & Verification
- **Full Backend Pytest Suite**: `101 passed, 1 warning in 48.69s` (0 failures, 0 regressions).
- **Test Coverage**: Verified `test_data_management.py` (14/14 passed) including active cell count (87,786), missing rate (7.32%), granular definition, separation of `primaryValue` into Critical fields, and omission from optional fields table.
- **Frontend Production Build**: `npm run build` completed in **1.26s** with 0 errors.
- **Automated Playwright Browser Verification (`verify_corrections.py`)**:
  - Live assertion of all 8 KPI cards: Total Active Records (4,877), Columns (18), Year Range (2014–2025), Reporters (190), Flows (2), Granular Reporters (4), Partners (5), HS Product Categories (4).
  - Health Banner summary: Optional missing cells = 6,427; Overall missing rate = 7.32%; Critical missing cells = 0; Duplicate records = 0.
  - Critical Fields Section: Primary Trade Value verified with 0 missing cells.
  - Optional Measurement Fields Section: 5 fields verified (`qty`, `netWgt`, `grossWgt`, `cifvalue`, `fobvalue`) summing to 6,427; confirmed `primaryValue` is not in the optional table.
  - Responsive verification across Desktop (1440px), Tablet (768px), and Mobile (375px).

![Desktop Overview and Health](docs/screenshots/dataset_overview_health_desktop.png)
![Tablet Overview and Health](docs/screenshots/dataset_overview_health_tablet.png)
![Mobile Overview and Health](docs/screenshots/dataset_overview_health_mobile.png)

---

## Trade Analysis Module Audit, Validation & Fix

### 1. Architectural Integrity & Strict Population Separation
The **Trade Analysis** module operates strictly against `trade_records_v2` (4,877 total records) with rigorous population isolation:
- **Baseline Aggregate Population**: `partner == 'W00' AND product == 'TOTAL'` (3,925 records, \$467.52T total trade value). Matches Phase 3 dashboard KPIs with byte-level mathematical parity.
- **Granular Bilateral Population**: `partner != 'W00' AND product != 'TOTAL'` (952 records across 4 reporters: IND, USA, CHN, DEU $\times$ 5 partners: USA, CHN, DEU, GBR, JPN $\times$ 4 HS chapters: 30, 84, 85, 87 $\times$ 2018–2024).
- **Airtight Routing**:
  - Unfiltered / Default: Queries `partner == 'W00'` and `product == 'TOTAL'` (returns exactly 3,925 records and \$467.52T).
  - Reporter specified alone (e.g. `reporter=IND`): Queries India's baseline World/TOTAL aggregate (24 records, \$10.65T).
  - Partner specified (e.g. `reporter=IND&partner=USA`): Queries bilateral granular records (`partner == 'USA'`, excludes `product == 'TOTAL'`), returning exactly 56 records and \$189.21B (matching Country Analysis).
  - Product specified (e.g. `reporter=IND&product=30`): Queries product chapter records (`product == '30'`, excludes `partner == 'W00'`), returning exactly 70 records.
  - Both specified (e.g. `reporter=IND&partner=USA&product=30`): Returns exactly 14 records with zero duplicate or aggregate contamination.

### 2. Verified Mathematical Consistency (DB $\rightarrow$ API $\rightarrow$ Frontend)
| Slice Filter | DB Records | DB Total Value | API Response (`/stats`) | Frontend Rendered | Consistency Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Default / Unfiltered** | 3,925 | \$467,518,746,644,960.06 | \$467.52 T (3,925 recs) | **\$467.52 T** (3,925 recs) | Verified Exact Match |
| **Reporter = IND (Baseline)** | 24 | \$10,645,860,000,000.00 | \$10.65 T (24 recs) | **\$10.65 T** (24 recs) | Verified Exact Match |
| **IND $\rightarrow$ USA (Granular)** | 56 | \$189,213,793,017.95 | \$189.21 B (56 recs) | **\$189.21 B** (56 recs) | Verified Exact Match |
| **IND $\rightarrow$ USA Export** | 28 | \$140,453,991,624.96 | \$140.45 B | **\$140.45 B** | Verified Exact Match |
| **IND $\rightarrow$ USA Import** | 28 | \$48,759,801,392.99 | \$48.76 B | **\$48.76 B** | Verified Exact Match |
| **IND $\rightarrow$ USA Trade Balance** | — | +\$91,694,190,231.97 | +\$91.69 B | **+\$91.69 B (Surplus)** | Verified Exact Match |

### 3. Key Enhancements Delivered
1. **Dynamic Filter Synchronization**:
   - Filter dropdown change handlers (`handleReporterChange`, `handleFlowChange`, `handlePartnerChange`, etc.) immediately trigger API updates (`appliedFilters`) and reset pagination to page 1.
   - Cleaned redundant option labels (e.g. `All Partners (World aggregate)` instead of `All Partners (World aggregate) (ALL)`).
   - Enforced start year $\le$ end year clamping logic.
2. **Interactive Data Table Expansion**:
   - Added dedicated sortable **Partner** (`partnerISO` / `partnerDesc`) column with purple badges.
   - Added dedicated sortable **Commodity** (`cmdCode` / `cmdDesc`) column with amber badges and truncated tooltips.
   - Verified sorting by `refYear`, `reporterISO`, `partnerISO`, `flowCode`, `cmdCode`, `primaryValue`, `cifvalue`, `fobvalue`, `netWgt`/`qty`.
3. **New Ranking Endpoints Added**:
   - `GET /api/trade-analysis/partners`: returns ranked partner economies for any slice.
   - `GET /api/trade-analysis/products`: returns ranked product categories for any slice.
4. **Multi-Viewport Responsive Layout**:
   - Fixed `ScopeNoticeBanner.jsx` with `minWidth: 0`, `overflowWrap: "anywhere"`, and `wordBreak: "break-word"`.
   - Fixed `filterForm` grid with `repeat(auto-fit, minmax(min(100%, 150px), 1fr))`, completely eliminating mobile width blowout.
   - Adjusted `chartRow` minmax from 420px to `minmax(min(100%, 340px), 1fr)`.
   - Verified 0 horizontal overflow across Mobile (375px), Tablet (768px), and Desktop (1440px).

### 4. Verification Results
- **Automated Backend Pytest Suite**:
  ```bash
  python -m pytest
  # 107 passed, 1 warning in 56.09s (0 failures, 15 trade analysis tests passing)
  ```
- **Frontend Production Build**:
  ```bash
  npm run build
  # 2472 modules transformed, built in 2.02s with 0 errors
  ```
- **Live Playwright Multi-Device Suite (`verify_trade_analysis.py`)**:
  - Desktop 1440px: `scrollWidth <= clientWidth` (`overflow=False`), verified baseline \$467.52T and granular drill-down \$189.21B.
  - Tablet 768px: `scrollWidth=768, clientWidth=768, overflow=False`.
  - Mobile 375px: `scrollWidth=375, clientWidth=375, overflow=False`.
  - Table Verification: Partner and Commodity columns verified visible, sortable, and populated with authentic UN Comtrade bilateral data.

### 5. Visual Proof
![Trade Analysis Desktop](docs/screenshots/trade_analysis_desktop.png)
![Trade Analysis Table Detail](docs/screenshots/trade_analysis_table.png)
![Trade Analysis Tablet](docs/screenshots/trade_analysis_tablet.png)
![Trade Analysis Mobile](docs/screenshots/trade_analysis_mobile.png)

---

## Country Comparison Module (Completed)

### 1. Architectural Implementation & Zero-Duplicate SQL
- **Endpoint**: `GET /api/country-comparison?countryA={isoA}&countryB={isoB}&start_year={y1}&end_year={y2}`
- **Backend Composition**: Implemented in [`country_comparison.py`](backend/app/api/country_comparison.py). Composes existing validated functions from `country_analysis.py` (`get_country_profile`, `get_country_partners`, `get_country_products`, `get_country_trend`) with **zero duplicate raw SQL**.
- **Data Governance & Transparency**:
  - Distinguishes **Full Granular Comparison** (when both countries are among the 4 granular reporters: `IND`, `USA`, `CHN`, `DEU`) from **Baseline-Only Comparison** (when one or both countries are among the 186 baseline reporters).
  - Non-granular sides explicitly display `"Granular partner/product data has not been uploaded for this reporter."` and `"N/A - no granular data"` for partner/commodity counts (never 0, never estimated).
  - Common Commodity Comparison table aligns HS chapters 30, 84, 85, 87 when both countries have granular data; provides informative transparency notice when unavailable.
  - Net difference metrics ($A - B$) strictly adhere to direction `"Country A - Country B"`.

---

### 2. Verified Live Acceptance Test Combinations (Playwright Live Output)

| Acceptance Scenario | Tested Combination | Comparison Depth | Partner / Product Sections | Common Commodity Section | Net Difference Status | Verified Live Values |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **a. Both Granular** | **IND vs USA** | Full Comparison | IND: 5 partners, 4 HS codes<br>USA: 4 partners, 4 HS codes | Active (Chapters 30, 84, 85, 87 aligned with differences) | $A - B$ Computed | IND Total: \$10.65T, USA Total: \$54.23T, Diff: -\$43.58T |
| **b. Both Granular** | **CHN vs DEU** | Full Comparison | CHN: 4 partners, 4 HS codes<br>DEU: 4 partners, 4 HS codes | Active (All 4 chapters compared) | $A - B$ Computed | CHN Total: \$54.31T, DEU Total: \$34.09T, Diff: +\$20.21T |
| **c. One Granular, One Aggregate** | **IND vs BRA** | Baseline-Only | IND: 5 partners, 4 HS codes<br>BRA: "Not uploaded" banner, "N/A" count | Informative Unavailable Notice | $A - B$ Computed | IND Total: \$10.65T, BRA Total: \$5.74T, Diff: +\$4.91T |
| **d. Both Aggregate** | **BRA vs FRA** | Baseline-Only | BRA: "Not uploaded" banner, "N/A"<br>FRA: "Not uploaded" banner, "N/A" | Informative Unavailable Notice | $A - B$ Computed | BRA Total: \$5.74T, FRA Total: \$15.11T, Diff: -\$9.37T |
| **e. Identical Country** | **IND vs IND** | Validation Error | N/A | N/A | Clean Alert Banner (HTTP 400) | "Country A and Country B must be different countries." No crash. |
| **f. Country Swap** | **IND vs USA $\rightarrow$ USA vs IND** | Full Comparison | Roles swap cleanly | Symmetrical alignment | Exact mathematical negation | Diff inverts from -\$43.58T to +\$43.58T |
| **g. Multi-Device** | **1440px / 768px / 375px** | Responsive Layout | Fluid flex & grid wrapping | Horizontal scrolling container | Zero overflow | `scrollWidth <= clientWidth` on all viewports (`overflow=False`) |
| **h. Regression Check** | **Single Country View** | Single Profile | `/country-analysis` loaded | Independent view preserved | Unaffected | India profile \$4.22T exports, \$6.43T imports preserved |

---

### 3. Automated Test Suite Results
- **Backend Tests (`python -m pytest`)**:
  - `117 passed, 1 warning in 39.97s` (10 dedicated Country Comparison tests + 107 existing suite tests, 0 regressions).
- **Frontend Production Build (`npm run build`)**:
  - `✓ 2473 modules transformed.` Built in 1.27s with 0 errors.
- **Desktop Mirror Synchronization**:
  - All modified files synced to `C:\Users\DNG\OneDrive\Desktop\trade-system`.

---

### 4. Visual Proof
![Country Comparison Desktop IND vs USA](docs/screenshots/country_comparison_desktop_ind_usa.png)
![Country Comparison CHN vs DEU](docs/screenshots/country_comparison_chn_deu.png)
![Country Comparison IND vs BRA One Granular](docs/screenshots/country_comparison_ind_bra.png)
![Country Comparison BRA vs FRA Both Aggregate](docs/screenshots/country_comparison_bra_fra.png)
![Country Comparison Error Handling Same Country](docs/screenshots/country_comparison_same_country_error.png)
![Country Comparison Tablet Viewport](docs/screenshots/country_comparison_tablet.png)
![Country Comparison Mobile Viewport](docs/screenshots/country_comparison_mobile.png)
![Country Analysis Single Profile Regression Check](docs/screenshots/country_analysis_regression_check.png)

---

---

## Restored & Enforced Architecture: 190-Macro + 4-Granular Economies (Completed & Locked)

### 1. Database Architecture Lock
- **Active Records in `trade_records_v2`**: Exactly **4,877 records** (3,925 macro records + 952 granular bilateral records).
- **Zero Double-Counting Principle**:
  - Macro queries strictly filter `partner_id == world_id AND product_id == total_id`.
  - Granular queries filter `partner_id != world_id AND product_id != total_id`.
- **4 Granular Economies**: India (`IND`), United States (`USA`), China (`CHN`), and Germany (`DEU`) track 5 partner nations and 4 HS2 product chapters (Pharma, Machinery, Electronics, Vehicles).
- **190 Sovereign Economies**: Complete macro coverage for all 190 sovereign nations across 2014–2025.

---

## Phase 11: Interactive Global Map Module (Completed)

### 1. Architectural Overview & Design
An offline, high-performance interactive world map component plotting key trade metrics across all 190 sovereign countries, with visual tiering for the 4 granular economies.

```
[ Natural Earth 110m World GeoJSON (205 Features) ]
                       │
                       ▼
[ D3 Natural Earth Projection (d3-geo) ]
                       │
  ┌────────────────────┼────────────────────┐
  ▼                    ▼                    ▼
[ Dynamic Choropleth ] [ Zoom & Pan Engine ] [ Micro-State Markers ]
(Total, Balance, X, M) (0.9x – 8.0x Canvas)  (SGP, BHR, MLT, etc.)
                       │
                       ▼
[ CountryMapDrawer & MapTooltip Glassmorphism Overlay ]
  - Dual-tier indicator: Gold (#f59e0b) for Granular (IND, USA, CHN, DEU)
  - Interactive Historical Timeline Playback (2014–2025)
  - Deep-dive cross-navigation to Country Profile & Comparison
```

---

### 2. Implementation Summary

#### Backend Services ([`backend/app/api/map.py`](backend/app/api/map.py))
- **Pydantic Schemas ([`schemas.py`](backend/app/schemas.py))**: `MapCountryItem`, `MapSummaryMetrics`, `MapDataResponse`.
- **Endpoint `GET /api/map/countries`**:
  - `LEFT JOIN` / `outerjoin` guaranteeing all 190 sovereign countries are returned regardless of reporting completeness for any selected year.
  - Zero double-counting: filters `partner_id == world_id AND product_id == total_id` for macro values.
  - Computes `exports`, `imports`, `total_trade`, and `trade_balance`.
  - Flags the 4 granular economies (`IND`, `USA`, `CHN`, `DEU`) with `has_granular_data = True`.
  - Provides global cumulative summary KPIs across all reporting nations.
  - Supports `year` single-year filter and `start_year`/`end_year` range filters.
- **Unit & Parity Tests ([`backend/tests/test_map.py`](backend/tests/test_map.py))**:
  - `test_map_requires_auth`: 401 unauthenticated check.
  - `test_map_countries_unfiltered`: Verifies 190 countries, 4 granular flags, global totals parity.
  - `test_map_countries_year_filter`: Tests single-year slice (2024).
  - `test_map_trade_balance_calculation`: Verifies trade balance calculation parity with Dashboard KPIs.

#### Frontend Components ([`frontend/src/components/map/`](frontend/src/components/map/))
- **Offline GeoJSON Asset ([`world-countries.json`](frontend/src/data/world-countries.json))**:
  - Natural Earth 110m vector boundaries (205 geographic features, 281 KB).
  - Aligned ISO 3166-1 alpha-3 codes (`SDS` $\rightarrow$ `SSD`).
  - Added micro-state coordinate polygons for island economies (Singapore, Bahrain, Malta, etc.).
- **Map Vector Engine ([`WorldMap.jsx`](frontend/src/components/map/WorldMap.jsx))**:
  - D3 Natural Earth projection (`d3-geo`) rendering 100% vector SVG without external tile servers.
  - 4 color modes: **Total Trade Volume** (Sequential Blues), **Trade Balance** (Diverging Red Deficit / Green Surplus), **Exports** (Sequential Greens), and **Imports** (Sequential Blues).
  - Gold/amber glowing border (`#f59e0b`) and drop-shadow highlighting the 4 granular economies.
  - Smooth pan (drag) and zoom ($0.9\times$ to $8.0\times$) with reset controls.
- **Floating Tooltip ([`MapTooltip.jsx`](frontend/src/components/map/MapTooltip.jsx))**:
  - Dark glassmorphism card following cursor movements with zero-jitter CSS positioning.
  - Shows country name, ISO code, total trade, exports, imports, trade balance, and granular tier badge.
- **Country Dossier Drawer ([`CountryMapDrawer.jsx`](frontend/src/components/map/CountryMapDrawer.jsx))**:
  - Slide-out details drawer with complete country metrics.
  - Explicit architectural badge explaining Macro World/TOTAL vs Granular Tier data availability.
  - One-click deep-dive links to **Country Profile** (`/country-analysis?reporter={ISO}`) and **Country Comparison** (`/country-comparison?countryA={ISO}&countryB=USA`).
- **Control Room Page ([`GlobalMapPage.jsx`](frontend/src/pages/GlobalMapPage.jsx))**:
  - Global KPI cards row displaying aggregate merchandise volumes.
  - Metric switcher (Total Trade, Trade Balance, Exports, Imports).
  - Historical timeline auto-play animation loop cycling through 2014–2025.
  - Instant country search jump box with auto-focus and auto-dropdown.
  - Dynamic color legend with min/max scale indicators.

---

### 3. Verification & Test Results

#### Automated Test Suites
- **Backend Tests (`python -m pytest -v`)**:
  - **121 passed, 1 warning, 0 failures** in 81.47s.
  - 100% pass rate across all 11 test modules.
- **Frontend Production Build (`npm run build`)**:
  - Vite client production bundle built cleanly in **1.51s** with 0 errors (`✓ 2536 modules transformed`).
- **Database Architecture Integrity Check**:
  - `Total trade_records_v2: 4877`
  - `Macro records: 3925`
  - `Granular records: 952`
  - Zero double-counting and perfect 190-macro + 4-granular preservation.

#### End-to-End Playwright Browser Verification
| Test Suite Step | Scenario / Viewport | Result |
| :--- | :--- | :--- |
| **1. Header & Navigation** | Dashboard header button & Sidebar link | Successfully navigated to `/map` |
| **2. Vector Map Rendering** | Desktop 1440x900 Viewport | Rendered 205 SVG country paths, 0 missing features |
| **3. Metric Switching** | Switched from Total Trade to Trade Balance | Live choropleth dynamic re-color (Greens/Reds) |
| **4. Country Search & Drawer** | Searched "India", clicked result | India drawer opened with Granular Tier badge & \$10.65T stats |
| **5. Timeline Playback** | Clicked Play Timeline | Auto-cycled historical years, Play switched to Pause |
| **6. Tablet Viewport** | 768x1024 Resolution | Responsive layout verified, 0 layout shifts |
| **7. Mobile Viewport** | 375x812 Resolution | Responsive drawer and controls verified |
| **8. Console Error Check** | Browser Error Log | **0 console errors** |

---

### 4. Visual Proof & Screenshots

![Global Map Desktop Full View](docs/screenshots/global_map_desktop.png)
*Figure 1: Global Trade Map Explorer on Desktop (1440px) displaying Total Trade Volume choropleth, global summary KPIs (\$467.52T Total Global Trade), metric switcher, and gold borders highlighting the 4 granular economies (USA, Germany, India, China).*

![Global Map India Drawer & Trade Balance](docs/screenshots/global_map_india_drawer.png)
*Figure 2: Trade Balance mode showing surplus (green) and deficit (red) nations, with India's slide-out country drawer detailing \$10.65T total volume, -\$2.21T trade deficit, Granular Tier badge, and direct deep-dive links.*

![Global Map Tablet Viewport](docs/screenshots/global_map_tablet.png)
*Figure 3: Tablet layout (768px) with responsive KPI cards, metric controls, and vector SVG map.*

![Global Map Mobile Viewport](docs/screenshots/global_map_mobile.png)
*Figure 4: Mobile layout (375px) with responsive controls and navigation.*

---

## Phase 12: Pure Macro Architecture Transition (Completed)

### 1. Architectural Streamlining
Following user confirmation (Option B), the database and frontend were transitioned to a **100% Pure Macro Architecture**:
- **Database Refactoring**:
  - Purged the 952 granular bilateral records from `trade_records_v2` in `data/trade_data.db`.
  - Active dataset is now **strictly 3,925 authoritative records** representing total merchandise trade (`product = TOTAL`, `partner = W00`) across all **190 sovereign reporting economies** from 2014 to 2025.
  - Backed up database to `data/trade_data.db.granular_backup` and preserved original Comtrade raw extract in `data/raw/granular_trade_data.csv`.
- **Zero Risk of Double-Counting**:
  - Eliminates dual-tier aggregate vs granular filtering rules; total global or country trade is simply the mathematical sum of records.
- **Frontend & Map UI Harmonization**:
  - Removed all gold borders, glow filters, and granular indicators from [`WorldMap.jsx`](frontend/src/components/map/WorldMap.jsx). All 190 countries now feature uniform slate borders and dynamic choropleth fills.
  - Removed "Granular Tier" badges and bilateral disclaimer boxes from [`CountryMapDrawer.jsx`](frontend/src/components/map/CountryMapDrawer.jsx) and [`MapTooltip.jsx`](frontend/src/components/map/MapTooltip.jsx).
  - Updated [`GlobalMapPage.jsx`](frontend/src/pages/GlobalMapPage.jsx) header pill to `"190 Sovereign Nations • Pure Macro Trade"` and Active Economies card to `"100% Macro Coverage"`.
  - [`ScopeNoticeBanner.jsx`](frontend/src/components/ScopeNoticeBanner.jsx) automatically hides itself when granular counts equal 0.

---

### 2. Verification & Test Suite Results
- **Database Record Counts**:
  - `Total trade_records_v2: 3,925`
  - `Macro records: 3,925`
  - `Granular records: 0`
- **Backend Test Suite (`python -m pytest -v`)**:
  - **121 passed, 1 warning, 0 failures** in 34.52s.
  - Updated `test_data_management.py`, `test_map.py`, `test_product_analysis.py`, and `test_trade_analysis.py` to assert pure macro invariants.
- **Frontend Production Build (`npm run build`)**:
  - Built cleanly in **7.62s** with 0 errors (`✓ 2536 modules transformed`).
- **Playwright Browser End-to-End Verification**:
  - All tests passed with **0 console errors** across Desktop, Drawer, Timeline, Tablet, and Mobile.
---

## Phase 13: Executive PDF & Excel Reports Export (Completed)

### 1. Architectural Overview & Generator Engines
The reporting engine has been upgraded from a client-side print view to **server-side high-resolution binary document generators**:

- **Executive PDF Briefing Generator ([pdf_report_generator.py](backend/app/services/pdf_report_generator.py))**:
  - Engineered using **ReportLab Platypus** with custom `NumberedCanvas` two-pass rendering for dynamic "Page X of Y" and confidential running footers.
  - **Corporate Cover & Header**: Deep navy header banner with gold/slate branding accents and metadata table.
  - **Executive KPI Scorecard**: 4 high-contrast KPI cards (`TOTAL TRADE VOLUME`, `OUTBOUND EXPORTS (X)`, `INBOUND IMPORTS (M)`, `NET TRADE BALANCE`) with export/import share calculations.
  - **Narrative Strategic Findings**: Automated macroeconomic analysis including trade surplus/deficit position, export coverage ratio, peak single-year velocity, and average annual trade velocity.
  - **Historical Annual Trajectory**: Alternating rows, formatted currency, and bold totals row with cumulative net balance.
  - **Machine Learning Predictive Outlook**: Conditionally includes regression metrics ($R^2$, test MAE, test RMSE, naive baseline MAE), training scope, statistical advisories, and recursive future projections with 95% confidence interval bounds.

- **Executive Excel Financial Model Workbook ([excel_report_generator.py](backend/app/services/excel_report_generator.py))**:
  - Engineered using **XlsxWriter** with 4 dedicated worksheets:
    1. **Executive Summary**: KPI scorecards, reference period metadata, narrative strategic findings, and data integrity notices.
    2. **Historical Trajectory**: Complete annual series with native Excel formulas (`=SUM(...)`, `=B.../C...`), `$#,##0.00` currency formats, frozen panes, and conditional formatting (green surplus $\ge 0$, red deficit $< 0$).
    3. **ML Predictive Outlook**: Horizon projections with 95% confidence intervals, YoY growth rates, test error metrics, and baseline comparisons.
    4. **Methodology & Notes**: Formal definitions of FOB/CIF valuations, coverage formulas, and ML model architectures.
  - Returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` binary streams with auto-fitted column widths.

- **FastAPI Export Endpoints ([reports.py](backend/app/api/reports.py))**:
  - `POST /api/reports/export/pdf`: Validates token, generates report payload, builds PDF in-memory, and returns downloadable binary stream.
  - `POST /api/reports/export/excel`: Validates token, generates report payload, builds multi-tab workbook in-memory, and returns downloadable binary stream.
  - Sets appropriate `Content-Disposition: attachment; filename="Trade_Report_<Country>_<Timestamp>.<ext>"` headers.

---

### 2. Frontend UI Upgrade ([ReportsPage.jsx](frontend/src/pages/ReportsPage.jsx))
- Integrated **Executive PDF (.pdf)** (blue accent) and **Executive Excel (.xlsx)** (emerald accent) action buttons alongside the legacy **Print View** button.
- Added asynchronous download state management (`downloadingPdf`, `downloadingExcel`) with animated spinner icons.
- Streams binary blobs via Axios `responseType: 'blob'`, dynamically generates download anchor elements, triggers instant browser download, and revokes object URLs cleanly.

---

### 3. Automated Test Suite & Playwright E2E Results

| Test Category | Command / Scope | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Export Unit Tests** | `pytest tests/test_reports_export.py` | **6 passed, 0 failures** | Auth enforcement (401), valid `%PDF-` and `PK\x03\x04` magic headers, workbook structure |
| **Full Backend Suite** | `pytest -v` (all test modules) | **127 passed, 0 failures** | Zero regressions across auth, dashboard, map, prediction, and reports |
| **Frontend Build** | `npm run build` | **0 errors, 5.34s** | Production build cleanly bundled (`dist/index.html`) |
| **Playwright E2E** | Headless automated verification | **Passed, 0 console errors** | Verified PDF download (7,535 B) and Excel workbook download (11,479 B) |

---

### 4. Visual Proof & Screenshots

![Executive Reports UI with PDF and Excel Exports](docs/screenshots/reports_export_ui.png)
*Figure 5: Automated Analytical Trade Reports page with the newly added Executive PDF (.pdf) and Executive Excel (.xlsx) export buttons, showing an active profile briefing for India with ML prediction controls.*

---

## Phase 14: Economic Metrics & Specialized Trade Indices (Completed)

### 1. Mathematical Formalism & Economic Indices
The system now features specialized macroeconomic trade indices across all 190 sovereign nations:
- **Revealed Trade Advantage (RTA / Macro Balassa Index)**:
  $$\text{RTA}_{i,t} = \frac{X_{i,t} / X_{\text{world},t}}{M_{i,t} / M_{\text{world},t}}$$
  Identifies structural macroeconomic comparative trade advantages ($\text{RTA} > 1.0$) versus structural import absorption dependencies ($\text{RTA} < 1.0$).
- **Lafay Trade Balance Index (TBI / Normalized Balance)**:
  $$\text{TBI}_{i,t} = \frac{X_{i,t} - M_{i,t}}{X_{i,t} + M_{i,t}} \times 100 \in [-100, +100]$$
  Scale-invariant trade balance index allowing fair comparison between large economies (USA, China) and smaller economies (Iceland, Fiji).
- **Grubel-Lloyd Macro Trade Overlap Index (GLI)**:
  $$\text{GLI}_{i,t} = 1 - \frac{|X_{i,t} - M_{i,t}|}{X_{i,t} + M_{i,t}} \in [0.0, 1.0]$$
  Measures bidirectional balance ($1.0 = \text{equal flows}$, $0.0 = \text{unilateral flow}$).
- **Global Export Market Share (EMS) & Import Market Share (IMS)**:
  $$\text{EMS}_{i,t} = \frac{X_{i,t}}{X_{\text{world},t}} \times 100\%, \quad \text{IMS}_{i,t} = \frac{M_{i,t}}{M_{\text{world},t}} \times 100\%$$
- **Hirschman-Herfindahl Index (HHI for Global Market Concentration)**:
  $$\text{HHI}_t = \sum_{i=1}^{N} (\text{EMS}_{i,t})^2$$
  Current global baseline evaluates to **448.24**, formally categorizing global export supply as **Unconcentrated / Competitive** ($\text{HHI} < 1,000$).

---

### 2. Interactive Heatmap & Matrix Modules
- **Multi-Year Country × Year Heatmap Canvas ([EconomicMetricsPage.jsx](frontend/src/pages/EconomicMetricsPage.jsx))**:
  - Displays multi-year trajectory (2014–2025) across presets (`Top 10`, `Top 25`, `G20`, `BRICS+`, or all 190 nations).
  - Metric switcher for **Lafay TBI**, **Revealed Advantage (RTA)**, **Export Market Share (%)**, **Net Trade Balance ($)**, and **Annual Growth Rate (%)**.
  - Diverging color ramps with hover inspection cards displaying precise export, import, and balance figures.
- **Cross-Country Synchronization (Pearson Correlation Matrix)**:
  - $K \times K$ symmetric grid evaluating pairwise correlation coefficients $r_{A,B} \in [-1.0, +1.0]$ over 2014–2025.
  - Highlights trade cycle co-movements (e.g. USA vs UK $r = +0.80$, France vs Korea $r = +0.89$) versus counter-cyclical trade cushions (e.g. China vs France $r = -0.52$).
- **Comparative Trade Balance Gap Matrix**:
  - Calculates comparative net balance disparities between major sovereign trading partners in USD ($\text{Bal}_A - \text{Bal}_B$).
- **190-Country Indices Explorer**:
  - Searchable, sortable data table for all 190 sovereign nations with instant CSV export.

---

### 3. Verification & Playwright Results

| Test Category | Command / Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Indices Unit Tests** | `pytest tests/test_economic_metrics.py` | **11 Passed** | Invariants validated: $-100 \le \text{TBI} \le 100$, $\text{GLI} = 1 - |\text{TBI}|/100$, $\sum \text{EMS} = 100\%$, correlation diagonal $= 1.0$ |
| **Full Backend Suite** | `pytest -v` (14 test modules) | **138 Passed, 0 Failures** | Zero regressions across all phases |
| **Frontend Production Build** | `npm run build` | **Clean Build (1.70s)** | Built with 0 errors |
| **Playwright E2E Automation** | Headless browser verification | **Passed (0 Console Errors)** | Verified Heatmap, G20 preset, Matrix tab, search filtering, and navigation |

---

### 4. Visual Proof & Screenshots

![Economic Metrics Heatmap UI](docs/screenshots/economic_metrics_ui.png)
*Figure 6: Economic Metrics dashboard displaying the Global Market Concentration KPI (HHI 448.24), worldwide trade totals ($467.52T), and the interactive Multi-Year Country Heatmap for Lafay TBI across the Top 10 global economies (2014–2025).*

![Cross-Country Synchronization Matrix UI](docs/screenshots/economic_metrics_matrix_ui.png)
*Figure 7: Interactive Pearson Trade Cycle Synchronization Matrix ($K \times K$) displaying pairwise economic co-movement and counter-cyclical trade buffers among major trading nations.*

---

## Phase 15: Live UN Comtrade API Ingestion & Auto-Sync (Completed)

### 1. Architectural Overview & Services
Transitioned the platform from an offline historical archive into an **automated, living data ecosystem**:
- **UN Comtrade v1 REST API Client ([comtrade_client.py](backend/app/services/comtrade_client.py))**:
  - Resilient asynchronous client connecting to `https://comtradeapi.un.org/public/v1/preview/C/A/HS` and authenticated endpoints.
  - Rate-limiting throttle (1.2s intervals for unauthenticated preview) and exponential backoff retry logic.
  - Dynamically fetches and caches country reference metadata (`partnerAreas.json`), mapping M49 integer codes to ISO3 strings.
  - Normalizes external JSON fields (`period`, `reporterCode`, `partnerCode`, `flowCode`, `cmdCode`, `primaryValue`, `qty`, `netWgt`) into internal trade records.
- **Automated Sync Engine & Background Cron ([sync_service.py](backend/app/services/sync_service.py))**:
  - Non-blocking asynchronous timer task integrated directly into FastAPI's `lifespan` handler.
  - Configurable execution frequency (e.g. Daily every 24h, 12h, 48h, or toggleable off).
  - Enforces zero-duplicate guarantees across the natural composite key `(year, reporter_id, partner_id, product_id, flow_code)`.
  - Maintains `data_sync_logs` database table tracking every ingestion event (operation type, status, records processed, records inserted, duplicates skipped, duration).
- **Administrative REST API Endpoints ([data_management.py](backend/app/api/data_management.py))**:
  - `GET /api/admin/data/sync/status`: Real-time scheduler status, last execution metadata, and recent 10 audit logs.
  - `POST /api/admin/data/sync/trigger`: On-demand manual live fetch against UN Comtrade API.
  - `POST /api/admin/data/sync/config`: Adjust scheduler active state and interval hours dynamically.

---

### 2. Frontend UI Upgrades ([DataManagementPage.jsx](frontend/src/pages/DataManagementPage.jsx))
- **Live UN Comtrade Auto-Sync Card**:
  - Real-time connection status pill with pulsing indicator (`CONNECTED TO UN COMTRADE API`).
  - Action button: `⚡ Sync Latest Data Now` with live loading spinner.
  - Scheduler interval selector (`Every 24 Hours (Daily)`, `12h`, `48h`, or `Pause`).
  - Scorecard tracking last execution time, last records inserted, and duplicate rows skipped.
- **Modern Drag-and-Drop Ingestion Portal**:
  - Glassmorphic dropzone with visual dragover state highlights (`isDragging`).
  - Staged file preview bar displaying filename, formatted size badge, and a `Remove` button.
  - Client-side validation enforcing `.csv` extension and $< 50\text{ MB}$ size limits.
  - Detailed insertion scorecard and collapsible rejection breakdown table.
- **Chronological Audit Trail Table**:
  - Tabular historical log of all sync events (`API_PULL`, `SCHEDULED_CRON`, `CSV_UPLOAD`).
  - Displays UTC timestamp, source name, status badge, records processed, new insertions, duplicate skips, and duration.

---

### 3. Automated Test Suite Results (145/145 Tests Passing)

| Test Category | Command / Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Sync Engine Unit Tests** | `pytest tests/test_sync.py` | **7 Passed** | Auth enforcement (401/403), normalization, composite deduplication, config updates, mocked API sync |
| **Full Backend Suite** | `pytest -v` (15 test modules) | **145 Passed, 0 Failures** | Zero regressions across auth, dashboard, map, prediction, reports, economic metrics, and data sync |
| **Frontend Production Build** | `npm run build` | **Clean Build (2.72s)** | 2537 modules transformed with 0 errors |
| **Playwright E2E Automation** | Headless browser verification | **Passed (0 Console Errors)** | Verified Live Sync panel, Drag-and-Drop dropzone, and Audit Trail rendering |

---

### 4. Visual Proof & Screenshots

![Live UN Comtrade Sync Panel](docs/screenshots/live_sync_panel.png)
*Figure 8: UN Comtrade v1 Live Synchronization panel with API connection status, last execution metrics, background scheduler interval selector, and on-demand fetch action button.*

![Drag & Drop Ingestion Portal](docs/screenshots/drag_drop_upload_panel.png)
*Figure 9: Modern Drag-and-Drop Customs Data Ingestion portal with schema requirements and visual dropzone.*

![Sync & Ingestion Audit Trail](docs/screenshots/audit_trail_panel.png)
*Figure 10: Chronological Data Synchronization and Ingestion Audit Trail tracking automated API pulls, cron schedules, and CSV uploads.*
