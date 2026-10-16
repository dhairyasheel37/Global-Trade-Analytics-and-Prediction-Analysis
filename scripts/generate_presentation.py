"""
Global Trade Analytics and Prediction Analysis
Automated PowerPoint Presentation Generator

Generates a modern, executive 16:9 presentation deck (15 slides)
with dark theme styling, key metrics, architecture details, and embedded screenshots.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs", "screenshots")
OUTPUT_PPTX = os.path.join(BASE_DIR, "docs", "Global_Trade_Analytics_Presentation.pptx")

# Color Palette (Platform Dark Theme)
C_BG = RGBColor(11, 17, 32)          # Deep Navy Background #0b1120
C_CARD = RGBColor(17, 24, 39)        # Midnight Card #111827
C_BORDER = RGBColor(30, 41, 59)      # Border Slate #1e293b
C_BLUE = RGBColor(59, 130, 246)      # Primary Azure #3b82f6
C_CYAN = RGBColor(56, 189, 248)      # Cyan Accent #38bdf8
C_EMERALD = RGBColor(16, 185, 129)   # Emerald Green #10b981
C_PURPLE = RGBColor(168, 85, 247)    # Violet Purple #a855f7
C_AMBER = RGBColor(245, 158, 11)     # Gold Amber #f59e0b
C_TEXT_WHITE = RGBColor(255, 255, 255) # Primary White #ffffff
C_TEXT_MUTED = RGBColor(148, 163, 184) # Muted Slate #94a3b8
C_TEXT_SUB = RGBColor(203, 213, 225)   # Subdued Slate #cbd5e1


def set_slide_background(slide):
    """Draws a full-slide dark background rectangle."""
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = C_BG
    bg.line.fill.background()
    return bg


def add_header(slide, category: str, title: str, subtitle: str = ""):
    """Adds a standardized category badge, main title, and optional subtitle."""
    # Category Tag Badge
    badge_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8.0), Inches(0.35))
    tf_b = badge_box.text_frame
    tf_b.word_wrap = True
    p_b = tf_b.paragraphs[0]
    p_b.text = category.upper()
    p_b.font.size = Pt(10)
    p_b.font.bold = True
    p_b.font.color.rgb = C_CYAN
    p_b.font.name = "Arial"

    # Slide Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.6))
    tf_t = title_box.text_frame
    tf_t.word_wrap = True
    p_t = tf_t.paragraphs[0]
    p_t.text = title
    p_t.font.size = Pt(22)
    p_t.font.bold = True
    p_t.font.color.rgb = C_TEXT_WHITE
    p_t.font.name = "Arial"

    # Subtitle if present
    if subtitle:
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.3), Inches(11.7), Inches(0.4))
        tf_s = sub_box.text_frame
        tf_s.word_wrap = True
        p_s = tf_s.paragraphs[0]
        p_s.text = subtitle
        p_s.font.size = Pt(11)
        p_s.font.color.rgb = C_TEXT_MUTED
        p_s.font.name = "Arial"


def add_footer(slide, current_slide: int, total_slides: int = 15):
    """Standardized dark-mode footer."""
    footer_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(11.7), Inches(0.35))
    tf = footer_box.text_frame
    p = tf.paragraphs[0]
    p.text = f"Global Trade Analytics Platform • UN Comtrade Intelligence • Dhairyasheel Gaikwad          Slide {current_slide} of {total_slides}"
    p.font.size = Pt(9)
    p.font.color.rgb = C_BORDER
    p.font.name = "Arial"


def add_card(slide, left, top, width, height):
    """Draws a subtle rounded card for grouping content."""
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = C_CARD
    card.line.color.rgb = C_BORDER
    card.line.width = Pt(1)
    return card


def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide1)

    # Accent decorative gradient glow line
    accent_line = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(2.5), Inches(0.06))
    accent_line.fill.solid()
    accent_line.fill.fore_color.rgb = C_BLUE
    accent_line.line.fill.background()

    # Title & Subtitle in single frame
    t_box = slide1.shapes.add_textbox(Inches(0.8), Inches(2.1), Inches(11.7), Inches(3.2))
    tf = t_box.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.text = "ENTERPRISE MACROECONOMIC INTELLIGENCE"
    p0.font.size = Pt(12)
    p0.font.bold = True
    p0.font.color.rgb = C_CYAN
    p0.font.name = "Arial"
    p0.space_after = Pt(12)

    p1 = tf.add_paragraph()
    p1.text = "Global Trade Analytics &\nPredictive Intelligence Platform"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = C_TEXT_WHITE
    p1.font.name = "Arial"
    p1.space_after = Pt(16)

    p2 = tf.add_paragraph()
    p2.text = "Macroeconomic Trade Balances • Box-Jenkins ARIMA & Machine Learning Projections • Geospatial Vector Mapping • What-If Tariff Simulation • Automated Executive Briefings"
    p2.font.size = Pt(13)
    p2.font.color.rgb = C_TEXT_SUB
    p2.font.name = "Arial"

    # Meta card at bottom
    meta_card = add_card(slide1, Inches(0.8), Inches(5.6), Inches(11.7), Inches(1.2))
    mb = slide1.shapes.add_textbox(Inches(1.0), Inches(5.7), Inches(11.3), Inches(1.0))
    mtf = mb.text_frame
    mtf.word_wrap = True

    mp1 = mtf.paragraphs[0]
    mp1.text = "Author & Lead Developer: Dhairyasheel Gaikwad  |  Email: dhairyasheelgaikwad8@gmail.com  |  GitHub: @dhairyasheel37"
    mp1.font.size = Pt(12)
    mp1.font.bold = True
    mp1.font.color.rgb = C_TEXT_WHITE
    mp1.font.name = "Arial"
    mp1.space_after = Pt(4)

    mp2 = mtf.add_paragraph()
    mp2.text = "Technology Stack: Python 3.12 • FastAPI • React 19 • Vite • SQLite • Scikit-Learn • Statsmodels • ReportLab • D3 / TopoJSON"
    mp2.font.size = Pt(11)
    mp2.font.color.rgb = C_CYAN
    mp2.font.name = "Arial"

    # =========================================================================
    # SLIDE 2: EXECUTIVE SUMMARY & PROBLEM STATEMENT
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide2)
    add_header(slide2, "Project Rationale", "Executive Summary & Problem Statement", "Bridging the gap between static trade records and predictive macroeconomic decision-making")
    add_footer(slide2, 2)

    # 3 Cards side-by-side
    card_w = Inches(3.64)
    card_h = Inches(4.8)
    top_y = Inches(1.8)

    # Card 1: The Challenge
    add_card(slide2, Inches(0.8), top_y, card_w, card_h)
    box1 = slide2.shapes.add_textbox(Inches(1.0), top_y + Inches(0.2), card_w - Inches(0.4), card_h - Inches(0.4))
    tf1 = box1.text_frame
    tf1.word_wrap = True
    p = tf1.paragraphs[0]
    p.text = "THE PROBLEM"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_AMBER
    bullets1 = [
        "Fragmented Trade Reporting: Asymmetric reporting periods and inconsistent commodity classifications across 190+ nations.",
        "Static Historical Reporting: Most institutional portals offer retrospective views without forward-looking trajectory modeling.",
        "Lack of Shock Simulation: Inability for policy analysts to simulate real-time tariff hikes, border carbon levies, or supply shocks.",
        "Absence of Real-Time Alerting: Critical trade deficit spikes and balance reversals go unnoticed until quarterly releases."
    ]
    for b in bullets1:
        p = tf1.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Card 2: The Solution
    add_card(slide2, Inches(4.84), top_y, card_w, card_h)
    box2 = slide2.shapes.add_textbox(Inches(5.04), top_y + Inches(0.2), card_w - Inches(0.4), card_h - Inches(0.4))
    tf2 = box2.text_frame
    tf2.word_wrap = True
    p = tf2.paragraphs[0]
    p.text = "OUR SOLUTION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    bullets2 = [
        "Unified Micro-to-Macro Pipeline: Normalizes 3,900+ raw UN Comtrade records into clean, validated, queryable SQLite aggregates.",
        "Advanced Econometric Suite: Formalized international indices (Lafay TBI, Revealed Trade Advantage, Grubel-Lloyd, HHI).",
        "4-Model Forecasting Engine: Box-Jenkins ARIMA, Holt-Winters ETS, Random Forest, and Linear Regression with AIC/BIC arena.",
        "Interactive Policy Simulator: Dynamic Armington elasticity modeling simulating price pass-through, tariff revenue, and flow diversion."
    ]
    for b in bullets2:
        p = tf2.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Card 3: Key Impact & Stats
    add_card(slide2, Inches(8.88), top_y, card_w, card_h)
    box3 = slide2.shapes.add_textbox(Inches(9.08), top_y + Inches(0.2), card_w - Inches(0.4), card_h - Inches(0.4))
    tf3 = box3.text_frame
    tf3.word_wrap = True
    p = tf3.paragraphs[0]
    p.text = "KEY PLATFORM METRICS"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_BLUE
    bullets3 = [
        "190 Sovereign Economies: Full geospatial TopoJSON vector coverage with directional trade flows.",
        "2026–2030 Projections: Multi-step recursive forecasts with expanding 95% confidence intervals.",
        "167 Automated Pytest Tests: 100% test pass rate with mathematical consistency regression guards.",
        "Enterprise Executive Delivery: Scheduled multi-page ReportLab PDF dossiers dispatched via TLS SMTP or in-app Outbox."
    ]
    for b in bullets3:
        p = tf3.add_paragraph()
        p.text = "• " + b
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # =========================================================================
    # SLIDE 3: SYSTEM ARCHITECTURE & FULL TECH STACK
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide3)
    add_header(slide3, "System Architecture", "Decoupled Enterprise Architecture & Technology Stack", "Modular design separating high-throughput ingestion, predictive computation, and interactive visualization")
    add_footer(slide3, 3)

    col_w = Inches(3.64)
    top_y = Inches(1.8)

    # Layer 1: Data & Storage
    add_card(slide3, Inches(0.8), top_y, col_w, Inches(4.8))
    b = slide3.shapes.add_textbox(Inches(1.0), top_y + Inches(0.2), col_w - Inches(0.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "DATA & INGESTION LAYER"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_CYAN
    items = [
        "UN Comtrade v1 REST Client: Dynamic rate limiting, pagination, M49 geographic code resolution.",
        "SQLite Relational Core: Indexed composite tables (trade_records_v2, alert_rules, outbox_logs).",
        "Data Cleaning Pipeline: Zero-guarded numeric coercion, schema validation, strict deduplication.",
        "Scheduled 24h Background Cron: Autonomous background synchronization worker in FastAPI lifespan."
    ]
    for item in items:
        p = tf.add_paragraph()
        p.text = "• " + item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Layer 2: API & Analytics Engines
    add_card(slide3, Inches(4.84), top_y, col_w, Inches(4.8))
    b = slide3.shapes.add_textbox(Inches(5.04), top_y + Inches(0.2), col_w - Inches(0.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "API & COMPUTATION LAYER"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_PURPLE
    items = [
        "FastAPI Asynchronous Gateway: JWT Bearer authentication, role-based access control (Admin / Trader).",
        "Predictive Modeling Core: Box-Jenkins ARIMA (p,d,q), Holt-Winters ETS, Random Forest (50 trees), OLS Regression.",
        "Scenario Simulator Engine: Armington elasticity equations computing price pass-through, diversion, and tariffs.",
        "ReportLab & OpenPyXL: Dynamic vector PDF charts and styled financial Excel workbooks."
    ]
    for item in items:
        p = tf.add_paragraph()
        p.text = "• " + item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Layer 3: Presentation & Delivery
    add_card(slide3, Inches(8.88), top_y, col_w, Inches(4.8))
    b = slide3.shapes.add_textbox(Inches(9.08), top_y + Inches(0.2), col_w - Inches(0.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "FRONTEND & DELIVERY LAYER"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    items = [
        "React 19 & Vite 8 SPA: Component-driven architecture with glassmorphic enterprise styling.",
        "D3 & TopoJSON Vector Map: Interactive offline global choropleth with slide-out country drawer.",
        "Recharts Data Visualization: Multi-series line charts, grouped bars, area envelopes, sensitivity curves.",
        "Enterprise Outbox Dispatcher: Real-time SMTP client with TLS, simulated outbox fallback, and PDF downloads."
    ]
    for item in items:
        p = tf.add_paragraph()
        p.text = "• " + item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # =========================================================================
    # SLIDE 4: INTERACTIVE GEOSPATIAL TRADE MAP
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide4)
    add_header(slide4, "Geospatial Visualizations", "Interactive Global Trade Vector Choropleth", "Zero-dependency D3 & TopoJSON choropleth rendering 190 sovereign nations with real-time balance classification")
    add_footer(slide4, 4)

    # Left text card
    add_card(slide4, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide4.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "CORE CAPABILITIES"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE
    bullets = [
        "100% Offline Vector Rendering: Utilizes local TopoJSON vector geometries without external map tile dependencies.",
        "Macro Trade Classification: Color-coded trade balance equilibrium:\n  • Emerald: Surplus Powerhouse (Net Exporter)\n  • Blue: Balanced Partner (Equilibrium)\n  • Amber/Red: Structural Net Importer",
        "Slide-Out Country Dossier Drawer: Clicking any sovereign territory smoothly slides out deep-dive metrics: bilateral exports, import sources, and historical growth.",
        "Cross-Device Responsive: Tested across desktop (1440px), tablet (768px), and mobile (375px) viewports."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Right Image
    img_path = os.path.join(SCREENSHOTS_DIR, "global_map_india_drawer.png")
    if os.path.exists(img_path):
        slide4.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 5: BILATERAL TRADE FLOW & COMMODITY ANALYSIS
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide5)
    add_header(slide5, "Bilateral Analytics", "Bilateral Flow Analytics & HS Commodity Deep-Dive", "Multi-tiered directional analysis tracking merchandise flows, sector market shares, and partner concentration")
    add_footer(slide5, 5)

    add_card(slide5, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide5.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "ANALYTICAL HIGHLIGHTS"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_CYAN
    bullets = [
        "Directional Balance Separation: Simultaneously tracks gross exports, gross imports, and net trade balance per bilateral pair.",
        "Harmonized System (HS) Chapters: Granular drill-down across industrial sectors (electronics, machinery, agriculture, mineral fuels).",
        "Server-Side Data Grid: High-throughput pagination, multi-column sorting, and 1-click CSV data export for econometric modeling.",
        "Supplier Concentration Ranking: Identifies leading sovereign export partners and import dependencies with percentage market shares."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    img_path = os.path.join(SCREENSHOTS_DIR, "trade_analysis_desktop.png")
    if os.path.exists(img_path):
        slide5.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 6: COUNTRY COMPARISON MODULE
    # =========================================================================
    slide6 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide6)
    add_header(slide6, "Comparative Economics", "Bilateral Country Profile & Head-to-Head Comparison", "Side-by-side macroeconomic trade disparity benchmarking with mathematical symmetry verification")
    add_footer(slide6, 6)

    add_card(slide6, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide6.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "COMPARATIVE BENCHMARKING"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    bullets = [
        "Head-to-Head Country Comparison: Select any 2 nations to instantly calculate trade volume disparities and net balance gaps.",
        "Mathematical Swap Symmetry: Strict verification that comparing Country A vs B produces mathematically mirrored differentials compared to B vs A.",
        "Zero-Guarded Growth Rates: Prevents division-by-zero artifacts on emerging sectors with zero baseline volumes.",
        "Bilateral Exposure Ratios: Visualizes bilateral dependencies (e.g. USA vs India, China vs Germany, Brazil vs France)."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    img_path = os.path.join(SCREENSHOTS_DIR, "country_comparison_desktop_ind_usa.png")
    if os.path.exists(img_path):
        slide6.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 7: SPECIALIZED ECONOMIC TRADE INDICES
    # =========================================================================
    slide7 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide7)
    add_header(slide7, "Macroeconomic Theory", "Specialized International Trade Economic Indices", "Empirical calculation of formalized trade competitiveness, specialization, and market overlap indices")
    add_footer(slide7, 7)

    add_card(slide7, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide7.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "FORMALIZED INDICES"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_PURPLE
    bullets = [
        "Lafay Trade Balance Index (TBI):\n  TBI = 100 * (X - M) / (X + M), normalized in [-100, +100].",
        "Revealed Trade Advantage (RTA / Balassa):\n  RTA = (X_i/X_w) / (M_i/M_w), evaluating true export advantage.",
        "Grubel-Lloyd Index (GLI):\n  GLI = 1 - (|X - M| / (X + M)), quantifying intra-industry macro overlap.",
        "Hirschman-Herfindahl Index (HHI):\n  Measures partner diversification and market concentration.",
        "Interactive 2D Matrix Heatmaps: Hover tooltips with export-import split bars and crosshair highlighting."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(6)

    img_path = os.path.join(SCREENSHOTS_DIR, "economic_metrics_ui.png")
    if os.path.exists(img_path):
        slide7.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 8: ADVANCED MACHINE LEARNING FORECASTING ENGINE
    # =========================================================================
    slide8 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide8)
    add_header(slide8, "Predictive Intelligence", "Advanced Machine Learning Forecasting Engine", "Dedicated univariate Box-Jenkins time-series and ensemble algorithms generating 2026–2030 projections")
    add_footer(slide8, 8)

    add_card(slide8, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide8.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "4-MODEL FORECASTING SUITE"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_CYAN
    bullets = [
        "Box-Jenkins ARIMA (p,d,q): Automated grid search minimizing Akaike Information Criterion (AIC), stationarity differencing (d=1), and analytical variance propagation.",
        "Holt-Winters ETS (A, Ad, N): State-space exponential smoothing with additive damped trend and level decay optimization (alpha, beta, phi).",
        "Random Forest Regressor: 50 shallow decision trees with bootstrap aggregation to prevent macro overfitting.",
        "Linear Regression (OLS): 3-year autoregressive lags, rolling mean, and linear time trend baseline.",
        "Expanding 95% Confidence Intervals: Calculates statistical bounds expanding over multi-step forecast horizons (2026–2030)."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(6)

    img_path = os.path.join(SCREENSHOTS_DIR, "ml_arima_diagnostics_view.png")
    if os.path.exists(img_path):
        slide8.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 9: MODEL COMPARISON ARENA & MULTI-MODEL OVERLAY
    # =========================================================================
    slide9 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide9)
    add_header(slide9, "Model Benchmarking", "Model Comparison Arena & Multi-Model Curve Overlay", "Side-by-side metric matrix comparing out-of-sample accuracy, parsimony criteria, and simultaneous multi-curve overlays")
    add_footer(slide9, 9)

    add_card(slide9, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide9.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "THE COMPARISON ARENA"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE
    bullets = [
        "Out-of-Sample Metric Matrix: Side-by-side comparison of MAE, RMSE, MAPE, and R² across all 4 models and the Naive Mean Baseline.",
        "Akaike (AIC) & Bayesian (BIC) Scores: Penalizes model complexity to select the most statistically parsimonious architecture.",
        "1-Click 'Deploy to Chart': Dynamically toggle which model drives the master trajectory.",
        "Multi-Model Overlay View: Renders projections from all 4 models simultaneously branching from historical actuals into 2026–2030.",
        "Consensus Mean Aggregation: Computes ensemble mean across all models with model divergence metrics."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(6)

    img_path = os.path.join(SCREENSHOTS_DIR, "ml_comparison_arena_overview.png")
    if os.path.exists(img_path):
        slide9.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 10: SCENARIO SIMULATOR & TARIFF IMPACT ENGINE
    # =========================================================================
    slide10 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide10)
    add_header(slide10, "Economic Policy Modeling", "Scenario Simulator & Tariff Impact Engine ('What-If')", "Simulates geopolitical shocks, tariff hikes, consumer price pass-through, and trade flow diversion")
    add_footer(slide10, 10)

    add_card(slide10, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide10.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "SIMULATION CAPABILITIES"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_AMBER
    bullets = [
        "Armington Price Elasticity: Computes price pass-through and quantity demand shifts (%ΔQ = ε_d * τ) with logarithmic boundaries.",
        "Curated Geopolitical Presets:\n  • US-China Section 301 Tariff Hike (+25%)\n  • Global Tech & Electronics Slump (-15%)\n  • EU Carbon Border Adjustment Levy (+12%)\n  • Indo-US Free Trade Liberalization (-10%)",
        "Laffer-Style Sensitivity Curves: Evaluates optimal customs revenue yields versus trade volume destruction.",
        "Trade Diversion Winners: Models substitution effects where third-party nations capture redirected trade flows.",
        "Automated Policy Briefing: Generates natural language executive policy summaries with 1-click CSV/JSON export."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(5)

    img_path = os.path.join(SCREENSHOTS_DIR, "scenario_simulator_overview.png")
    if os.path.exists(img_path):
        slide10.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 11: LIVE UN COMTRADE INGESTION & DATA MANAGEMENT
    # =========================================================================
    slide11 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide11)
    add_header(slide11, "Data Operations", "Live UN Comtrade API Ingestion & Data Management", "Automated synchronization pipeline querying UN Comtrade v1 REST APIs with rate limiting and audit trail logging")
    add_footer(slide11, 11)

    add_card(slide11, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide11.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "DATA PIPELINE HIGHLIGHTS"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_CYAN
    bullets = [
        "UN Comtrade v1 REST Client: Dynamic rate limiting, pagination, M49 geographic code resolution, and reference metadata caching.",
        "Background 24h Scheduler: Asynchronous background worker in FastAPI lifespan executing validation, cleaning, deduplication, and database indexing.",
        "Drag-and-Drop Ingestion Portal: Drag-and-drop dropzone on /data-management with instant schema checking and audit trail logging.",
        "Zero-Data Corruption Guard: Enforces database transactions and rollback safety on malformed CSV records."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    img_path = os.path.join(SCREENSHOTS_DIR, "data_management_live_sync.png")
    if os.path.exists(img_path):
        slide11.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 12: AUTOMATED EXECUTIVE EMAIL BRIEFINGS & RISK ALERTS
    # =========================================================================
    slide12 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide12)
    add_header(slide12, "Enterprise Delivery", "Automated Executive Briefings & Risk Alerts Engine", "Automated PDF dossier subscriptions and intelligent macroeconomic anomaly threshold monitors")
    add_footer(slide12, 12)

    add_card(slide12, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide12.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "DELIVERY & ALERTING"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    bullets = [
        "Recurring Executive PDF Dossiers: Dispatches high-resolution multi-page PDF reports (Daily, Weekly, Monthly, On-Sync).",
        "Macroeconomic Threshold Rules:\n  • Deficit Expansion YoY (> 20%)\n  • Severe Export Contraction (> 15%)\n  • Sudden Inbound Import Surge\n  • Surplus-to-Deficit Reversal Flips",
        "Incident Lifecycle Management: Full operational workflow tracking (TRIGGERED -> ACKNOWLEDGED -> RESOLVED).",
        "Enterprise Outbox Dispatcher: SMTP with STARTTLS support, simulated in-app Development Outbox fallback, and direct in-portal PDF downloads."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(6)

    img_path = os.path.join(SCREENSHOTS_DIR, "alerts_briefings_tab.png")
    if os.path.exists(img_path):
        slide12.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 13: EXECUTIVE PDF & EXCEL REPORTING ENGINES
    # =========================================================================
    slide13 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide13)
    add_header(slide13, "Reporting Subsystem", "Multi-Page Executive PDF & Excel Financial Models", "Automated publication engine producing boardroom-ready PDF briefing dossiers and formatted OpenPyXL spreadsheets")
    add_footer(slide13, 13)

    add_card(slide13, Inches(0.8), Inches(1.8), Inches(4.8), Inches(4.8))
    b = slide13.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(4.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "REPORTING HIGHLIGHTS"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_BLUE
    bullets = [
        "ReportLab PDF Dossiers: Multi-page high-resolution executive reports with branded headers, KPI grids, trade balance distributions, and automated page numbering.",
        "Integrated ML Projections: Embedded forecast tables displaying projected values, 95% confidence bands, and algorithm parameters.",
        "OpenPyXL Financial Models: Styled header fills, formatted currency cells ($USD Billions), auto-fitted column widths, and summary statistical rows.",
        "Verbatim Transparency Disclaimers: Prominent methodology notices explaining short-horizon caveats and baseline comparisons."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    img_path = os.path.join(SCREENSHOTS_DIR, "reports_export_ui.png")
    if os.path.exists(img_path):
        slide13.shapes.add_picture(img_path, Inches(5.8), Inches(1.8), width=Inches(6.7))

    # =========================================================================
    # SLIDE 14: TESTING, RELIABILITY & VERIFICATION SUITE
    # =========================================================================
    slide14 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide14)
    add_header(slide14, "Quality Engineering", "Comprehensive Testing, Reliability & Verification", "Rigorous automated test suites verifying mathematical consistency, security, and UI responsiveness")
    add_footer(slide14, 14)

    card_w = Inches(3.64)
    top_y = Inches(1.8)

    # Card 1: Backend Pytest Suite
    add_card(slide14, Inches(0.8), top_y, card_w, Inches(4.8))
    b = slide14.shapes.add_textbox(Inches(1.0), top_y + Inches(0.2), card_w - Inches(0.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "167 PYTEST TESTS (100%)"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    items = [
        "167 Passed, 0 Failed (~50s execution across 17 test modules).",
        "Authentication & Security: Role-based access control, password hashing, JWT expiration.",
        "Mathematical Consistency: Bilateral balance symmetry (Ind vs USA == - USA vs Ind).",
        "ML Bounds Enforcement: Out-of-sample MAE comparisons, AIC/BIC validation, 95% CI expansion.",
        "Alert Audits: Deficit delta thresholds, deduplication guards, outbox PDF persistence."
    ]
    for item in items:
        p = tf.add_paragraph()
        p.text = "• " + item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Card 2: Frontend Production Build
    add_card(slide14, Inches(4.84), top_y, card_w, Inches(4.8))
    b = slide14.shapes.add_textbox(Inches(5.04), top_y + Inches(0.2), card_w - Inches(0.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "CLEAN FRONTEND BUILD"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_CYAN
    items = [
        "Vite 8 & React 19: Clean production compilation in ~1.15 seconds.",
        "2,539 Modules Transformed with zero syntax or bundling errors.",
        "Gzip Optimization: Minified chunk distribution with asset caching.",
        "Responsive Breakpoint Verification: Desktop (1440px), Tablet (768px), and Mobile (375px)."
    ]
    for item in items:
        p = tf.add_paragraph()
        p.text = "• " + item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Card 3: E2E Browser Automation
    add_card(slide14, Inches(8.88), top_y, card_w, Inches(4.8))
    b = slide14.shapes.add_textbox(Inches(9.08), top_y + Inches(0.2), card_w - Inches(0.4), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "PLAYWRIGHT AUTOMATION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_PURPLE
    items = [
        "Headless Browser Verification: End-to-end user journey simulation.",
        "0 Console Errors: Clean execution without unhandled exceptions.",
        "Automated Screenshot Captures: Preserves visual proof across all module workflows.",
        "Real-Time Interaction Testing: Presets, sliders, tab navigation, modals, and download links."
    ]
    for item in items:
        p = tf.add_paragraph()
        p.text = "• " + item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # =========================================================================
    # SLIDE 15: CONCLUSION & ROADMAP
    # =========================================================================
    slide15 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide15)
    add_header(slide15, "Conclusion & Roadmap", "Summary, Real-World Impact & Future Horizons", "Transforming global trade data into proactive macroeconomic intelligence")
    add_footer(slide15, 15)

    add_card(slide15, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8))
    b = slide15.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(5.2), Inches(4.4))
    tf = b.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "KEY ACHIEVEMENTS"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    bullets = [
        "Comprehensive End-to-End System: Covers full lifecycle from raw Comtrade ingestion to boardroom PDF briefing distribution.",
        "Rigorous Econometric Foundations: Formalized international trade indices, Armington elasticities, and Box-Jenkins time-series models.",
        "Zero-Regression Architecture: 167 automated tests guaranteeing 100% mathematical consistency and API reliability.",
        "Enterprise-Grade UX: Modern responsive design with glassmorphism, interactive charts, and instant downloads."
    ]
    for b_item in bullets:
        p = tf.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    add_card(slide15, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.8))
    b2 = slide15.shapes.add_textbox(Inches(7.0), Inches(2.0), Inches(5.3), Inches(4.4))
    tf2 = b2.text_frame
    tf2.word_wrap = True
    p = tf2.paragraphs[0]
    p.text = "FUTURE ROADMAP & CONNECT"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_CYAN
    bullets2 = [
        "Granular HS 6-Digit Expansion: Drill down to micro-product lines (e.g. semiconductors, lithium-ion cells).",
        "Real-Time FX & Currency Adjustments: Purchasing power parity (PPP) and real effective exchange rate (REER) normalization.",
        "Multilateral Trade Treaty Modeling: Simulating regional trade bloc agreements (RCEP, USMCA, CPTPP).",
        "Author: Dhairyasheel Gaikwad",
        "GitHub: https://github.com/dhairyasheel37",
        "Email: dhairyasheelgaikwad8@gmail.com"
    ]
    for b_item in bullets2:
        p = tf2.add_paragraph()
        p.text = "• " + b_item
        p.font.size = Pt(10)
        p.font.color.rgb = C_TEXT_SUB
        p.space_after = Pt(8)

    # Save presentation
    prs.save(OUTPUT_PPTX)
    print(f"Presentation saved successfully to: {OUTPUT_PPTX}")


if __name__ == "__main__":
    build_deck()
