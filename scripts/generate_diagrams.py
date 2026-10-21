"""
Generate System Modeling UML & Architecture Diagrams for B.Tech Capstone Report
"""
import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def draw_dfd():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    fig.patch.set_facecolor("#ffffff")

    # Title
    ax.text(5, 5.6, "Data Flow Diagram: Level 0 (Context) & Level 1", fontsize=14, fontweight="bold", ha="center", color="#0f2942")

    # External Entities
    box_props = dict(boxstyle="square,pad=0.5", fc="#e2e8f0", ec="#0f2942", lw=1.5)
    ax.text(1.2, 3.8, "Trade Policy\nAnalyst", ha="center", va="center", bbox=box_props, fontsize=10, fontweight="bold")
    ax.text(1.2, 1.8, "System\nAdministrator", ha="center", va="center", bbox=box_props, fontsize=10, fontweight="bold")
    ax.text(8.8, 3.8, "UN Comtrade\nv1 REST API", ha="center", va="center", bbox=box_props, fontsize=10, fontweight="bold")
    ax.text(8.8, 1.8, "SMTP Mail\nServer Gateway", ha="center", va="center", bbox=box_props, fontsize=10, fontweight="bold")

    # Central Process
    proc_props = dict(boxstyle="circle,pad=0.6", fc="#3b82f6", ec="#1e3a8a", lw=2)
    ax.text(5, 2.8, "Global Trade\nAnalytics &\nPrediction\nPlatform", ha="center", va="center", bbox=proc_props, fontsize=10, fontweight="bold", color="white")

    # Arrows
    arrow_props = dict(arrowstyle="->", lw=1.5, color="#1e3a8a")
    ax.annotate("Tariff Shocks & Query Filters", xy=(3.8, 3.2), xytext=(2.2, 3.8), arrowprops=arrow_props, fontsize=8, ha="center")
    ax.annotate("Visual Analytics & Forecasts", xy=(2.2, 3.5), xytext=(3.8, 3.0), arrowprops=arrow_props, fontsize=8, ha="center")
    
    ax.annotate("CSV Data Upload & Config", xy=(3.8, 2.5), xytext=(2.2, 1.8), arrowprops=arrow_props, fontsize=8, ha="center")
    ax.annotate("Audit Logs & System Status", xy=(2.2, 1.5), xytext=(3.8, 2.3), arrowprops=arrow_props, fontsize=8, ha="center")

    ax.annotate("REST JSON Records Stream", xy=(6.2, 3.2), xytext=(7.8, 3.8), arrowprops=arrow_props, fontsize=8, ha="center")
    ax.annotate("Scheduled Briefings / Alerts", xy=(7.8, 1.8), xytext=(6.2, 2.5), arrowprops=arrow_props, fontsize=8, ha="center")

    # Data Store
    ax.plot([4.2, 5.8], [1.1, 1.1], color="#0f2942", lw=2)
    ax.plot([4.2, 5.8], [0.6, 0.6], color="#0f2942", lw=2)
    ax.text(5, 0.85, "D1: Relational SQLite DB (WAL Mode)", ha="center", va="center", fontsize=9, fontweight="bold", color="#0f2942")
    ax.annotate("", xy=(5, 1.1), xytext=(5, 1.8), arrowprops=dict(arrowstyle="<->", lw=1.5, color="#0f2942"))

    out_path = os.path.join(SCREENSHOTS_DIR, "system_dfd_diagram.png")
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    print("Generated:", out_path)

def draw_sequence():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    fig.patch.set_facecolor("#ffffff")

    ax.text(5, 5.6, "Sequence Diagram: Counterfactual Tariff Shock Simulation", fontsize=13, fontweight="bold", ha="center", color="#0f2942")

    lifelines = [
        (1.2, "Analyst / UI"),
        (3.5, "Simulator Router"),
        (6.0, "Armington Engine"),
        (8.5, "SQLite Database")
    ]

    for x, label in lifelines:
        box = dict(boxstyle="square,pad=0.3", fc="#1e293b", ec="none")
        ax.text(x, 5.0, label, ha="center", va="center", bbox=box, color="white", fontsize=9, fontweight="bold")
        ax.plot([x, x], [0.8, 4.7], color="#94a3b8", linestyle="--", lw=1.2)

    # Sequence steps
    steps = [
        (1, 1.2, 3.5, 4.3, "1. POST /api/simulator/simulate (tariff=25%)"),
        (2, 3.5, 8.5, 3.8, "2. Query baseline trade volume (USA -> CHN)"),
        (3, 8.5, 3.5, 3.3, "3. Return baseline trade volume ($450.2B)"),
        (4, 3.5, 6.0, 2.8, "4. calculate_tariff_shock(vol, tariff, pass_through)"),
        (5, 6.0, 6.0, 2.3, "5. Compute demand contraction & customs yield"),
        (6, 6.0, 3.5, 1.8, "6. Return post-shock volume & diversion rankings"),
        (7, 3.5, 1.2, 1.3, "7. 200 OK JSON (Trajectory, Laffer curve, Briefing)")
    ]

    for num, x1, x2, y, text in steps:
        if x1 == x2: # self call
            ax.plot([x1, x1+0.4, x1+0.4, x1], [y+0.2, y+0.2, y-0.1, y-0.1], color="#2563eb", lw=1.3)
            ax.text(x1+0.5, y+0.05, text, fontsize=7.5, color="#1e3a8a", va="center")
        else:
            style = "->" if x1 < x2 else "--"
            arrow = dict(arrowstyle="->" if x1 < x2 else "-|>", lw=1.3, color="#2563eb" if x1 < x2 else "#059669")
            ax.annotate("", xy=(x2, y), xytext=(x1, y), arrowprops=arrow)
            ax.text((x1+x2)/2, y+0.12, text, fontsize=8, ha="center", va="bottom", color="#1e293b", fontweight="500")

    out_path = os.path.join(SCREENSHOTS_DIR, "system_sequence_diagram.png")
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    print("Generated:", out_path)

def draw_activity():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    fig.patch.set_facecolor("#ffffff")

    ax.text(5, 5.6, "Activity Diagram: 4-Model Time-Series Forecasting Pipeline", fontsize=13, fontweight="bold", ha="center", color="#0f2942")

    # Start node
    start = patches.Circle((1.0, 4.8), 0.15, fc="#0f2942", ec="#0f2942")
    ax.add_patch(start)
    ax.text(1.0, 4.4, "Start Query", fontsize=8, ha="center", fontweight="bold")

    # Nodes
    node_box = dict(boxstyle="round,pad=0.3", fc="#f1f5f9", ec="#3b82f6", lw=1.3)
    ax.text(2.6, 4.8, "Fetch Bilateral\nTrade Records", ha="center", va="center", bbox=node_box, fontsize=8)
    
    # Decision
    dec = patches.RegularPolygon((4.4, 4.8), 4, radius=0.35, orientation=0, fc="#fef3c7", ec="#f59e0b", lw=1.3)
    ax.add_patch(dec)
    ax.text(4.4, 4.8, "N >= 8?", fontsize=7.5, ha="center", va="center", fontweight="bold")

    ax.text(6.3, 4.8, "Shift Lags & Window\n(Strict Anti-Leakage)", ha="center", va="center", bbox=node_box, fontsize=8)
    ax.text(8.5, 4.8, "Chronological Split\n(Train vs Holdout)", ha="center", va="center", bbox=node_box, fontsize=8)

    # Arena Parallel Boxes
    ax.text(8.5, 3.2, "Parallel Model Fitting:\n• OLS Linear Regression\n• Random Forest (50 Trees)\n• ARIMA (AIC Order Search)\n• Holt-Winters Exponential", ha="center", va="center", bbox=dict(boxstyle="square,pad=0.4", fc="#eff6ff", ec="#2563eb", lw=1.5), fontsize=8)

    ax.text(5.5, 3.2, "Evaluate Out-of-Sample Metrics\n(MAE, RMSE, MAPE, AIC, BIC)\nBenchmark vs. Mean Baseline", ha="center", va="center", bbox=node_box, fontsize=8)

    ax.text(2.6, 3.2, "Recursive Horizon (2026-2030)\nCompound 95% Confidence Bounds\n(y_hat +- 1.96 * std_err * √h)", ha="center", va="center", bbox=node_box, fontsize=8)

    # End node
    end_outer = patches.Circle((1.0, 3.2), 0.18, fc="none", ec="#0f2942", lw=1.5)
    end_inner = patches.Circle((1.0, 3.2), 0.12, fc="#0f2942", ec="#0f2942")
    ax.add_patch(end_outer)
    ax.add_patch(end_inner)
    ax.text(1.0, 2.8, "Render Arena", fontsize=8, ha="center", fontweight="bold")

    # Arrows
    arr = dict(arrowstyle="->", lw=1.2, color="#0f2942")
    ax.annotate("", xy=(2.0, 4.8), xytext=(1.2, 4.8), arrowprops=arr)
    ax.annotate("", xy=(4.0, 4.8), xytext=(3.2, 4.8), arrowprops=arr)
    ax.annotate("Yes", xy=(5.4, 4.8), xytext=(4.75, 4.8), arrowprops=arr, fontsize=8)
    ax.annotate("", xy=(7.7, 4.8), xytext=(7.2, 4.8), arrowprops=arr)
    ax.annotate("", xy=(8.5, 4.0), xytext=(8.5, 4.4), arrowprops=arr)
    ax.annotate("", xy=(7.1, 3.2), xytext=(7.5, 3.2), arrowprops=arr)
    ax.annotate("", xy=(3.8, 3.2), xytext=(4.2, 3.2), arrowprops=arr)
    ax.annotate("", xy=(1.3, 3.2), xytext=(1.7, 3.2), arrowprops=arr)

    # Insufficient data branch
    ax.annotate("No", xy=(4.4, 1.8), xytext=(4.4, 4.4), arrowprops=arr, fontsize=8)
    ax.text(4.4, 1.4, "Emit: 'Insufficient Historical Data'", ha="center", va="center", bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec="#ef4444"), fontsize=8)

    out_path = os.path.join(SCREENSHOTS_DIR, "system_activity_diagram.png")
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    print("Generated:", out_path)

def draw_component():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    fig.patch.set_facecolor("#ffffff")

    ax.text(5, 5.6, "Component Diagram: Global Trade System Architecture", fontsize=13, fontweight="bold", ha="center", color="#0f2942")

    # React Frontend Box
    ax.add_patch(patches.Rectangle((0.5, 0.8), 2.8, 4.4, fc="#f8fafc", ec="#0284c7", lw=1.5, ls="--"))
    ax.text(1.9, 4.9, "<<Component>>\nFrontend SPA (React 19)", ha="center", fontweight="bold", fontsize=9, color="#0369a1")
    ax.text(1.9, 4.0, "• Recharts Engine\n• D3-Geo TopoJSON\n• AuthContext & State\n• Axios API Client", ha="center", fontsize=8.5, color="#1e293b", bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="#cbd5e1"))

    # Backend Box
    ax.add_patch(patches.Rectangle((3.6, 0.8), 3.5, 4.4, fc="#f8fafc", ec="#16a34a", lw=1.5, ls="--"))
    ax.text(5.35, 4.9, "<<Component>>\nFastAPI Backend Application", ha="center", fontweight="bold", fontsize=9, color="#15803d")
    ax.text(5.35, 3.8, "• 18 Modular APIRouters\n• ML & ARIMA Time-Series Arena\n• Armington Policy Simulator\n• ReportLab PDF / OpenPyXL\n• Background Sync & Alerts Engine", ha="center", fontsize=8.5, color="#1e293b", bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="#cbd5e1"))

    # Database Box
    ax.add_patch(patches.Rectangle((7.4, 0.8), 2.2, 4.4, fc="#f8fafc", ec="#b45309", lw=1.5, ls="--"))
    ax.text(8.5, 4.9, "<<Component>>\nPersistence Tier", ha="center", fontweight="bold", fontsize=9, color="#b45309")
    ax.text(8.5, 3.8, "• SQLite DB (WAL)\n• 4,877 Trade Tuples\n• Composite Index\n• Raw CSV Volume\n• PDF Archive", ha="center", fontsize=8.5, color="#1e293b", bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="#cbd5e1"))

    # Connectors
    arr = dict(arrowstyle="<->", lw=1.5, color="#0f2942")
    ax.annotate("", xy=(3.6, 3.0), xytext=(3.3, 3.0), arrowprops=arr)
    ax.text(3.45, 3.2, "HTTP / REST\nJSON / Bearer", fontsize=7, ha="center", color="#0f2942")

    ax.annotate("", xy=(7.4, 3.0), xytext=(7.1, 3.0), arrowprops=arr)
    ax.text(7.25, 3.2, "SQLAlchemy\nORM Queries", fontsize=7, ha="center", color="#0f2942")

    out_path = os.path.join(SCREENSHOTS_DIR, "system_component_diagram.png")
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    print("Generated:", out_path)

def draw_deployment():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    fig.patch.set_facecolor("#ffffff")

    ax.text(5, 5.6, "Deployment Diagram: Multi-Tier Docker Container Orchestration", fontsize=13, fontweight="bold", ha="center", color="#0f2942")

    # Host Node
    ax.add_patch(patches.Rectangle((0.5, 0.6), 9.0, 4.6, fc="#f1f5f9", ec="#334155", lw=2))
    ax.text(5, 4.9, "<<Host Node>> Docker Engine (Windows / Linux / VPS)", ha="center", fontweight="bold", fontsize=10, color="#1e293b")

    # Container 1: Frontend
    ax.add_patch(patches.Rectangle((1.0, 1.2), 3.5, 3.3, fc="#ffffff", ec="#0284c7", lw=1.5))
    ax.text(2.75, 4.1, "<<Container>> global_trade_frontend\n(Nginx 1.27-alpine-slim)", ha="center", fontweight="bold", fontsize=8.5, color="#0369a1")
    ax.text(2.75, 2.7, "• Ports: 80:80, 5173:80\n• Sub-30 MB Image Footprint\n• Reverse Proxy: /api/ -> :8000\n• SPA Fallback Routing\n• Gzip & Asset Caching", ha="center", fontsize=8, color="#334155")

    # Container 2: Backend
    ax.add_patch(patches.Rectangle((5.5, 1.2), 3.5, 3.3, fc="#ffffff", ec="#16a34a", lw=1.5))
    ax.text(7.25, 4.1, "<<Container>> global_trade_backend\n(Python 3.12-slim-bookworm)", ha="center", fontweight="bold", fontsize=8.5, color="#15803d")
    ax.text(7.25, 2.7, "• Port: 8000:8000\n• Non-Root User: appuser (1000)\n• Uvicorn ASGI Server (2 Workers)\n• Periodic Healthcheck: /api/health\n• Mount: ./data -> /app/data", ha="center", fontsize=8, color="#334155")

    # Network Bridge
    ax.plot([4.5, 5.5], [2.8, 2.8], color="#6366f1", lw=2, linestyle="--")
    ax.text(5.0, 3.0, "Bridge Network:\ntrade-network", ha="center", fontsize=7.5, color="#4338ca", fontweight="bold")

    out_path = os.path.join(SCREENSHOTS_DIR, "system_deployment_diagram.png")
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    print("Generated:", out_path)

if __name__ == "__main__":
    draw_dfd()
    draw_sequence()
    draw_activity()
    draw_component()
    draw_deployment()
    print("All 5 UML & architecture diagrams successfully generated!")
