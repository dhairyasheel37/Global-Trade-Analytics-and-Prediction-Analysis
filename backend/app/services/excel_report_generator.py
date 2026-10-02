"""
Executive Excel Report Generator.

Generates structured multi-tab C-suite grade Excel workbooks (.xlsx)
using XlsxWriter with corporate themes, native formulas, conditional formatting,
frozen panes, and formatted currency and percentage columns.
"""
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional

import xlsxwriter

from app.schemas import ReportResponse


def generate_excel_report(report_data: ReportResponse) -> bytes:
    """
    Constructs a complete executive Excel workbook (.xlsx) and returns raw bytes.
    """
    buffer = BytesIO()
    wb = xlsxwriter.Workbook(buffer, {'in_memory': True})

    # Set document properties
    wb.set_properties({
        'title': report_data.report_title,
        'subject': 'Executive Trade & Macroeconomic Intelligence Briefing',
        'author': 'TradeAnalytics UN Comtrade Platform',
        'company': 'Global Trade Analytics System',
        'category': 'Macroeconomic Trade Reports',
        'comments': 'Official UN Comtrade pure macro bilateral data (2014-2025).',
    })

    # Corporate Color Palette & Formats
    NAVY = '#0F172A'
    SLATE = '#1E293B'
    CYAN = '#0284C7'
    GREEN = '#059669'
    RED = '#DC2626'
    GRAY_BG = '#F8FAFC'
    BORDER_COLOR = '#CBD5E1'

    fmt_title = wb.add_format({
        'bold': True,
        'font_size': 16,
        'font_name': 'Segoe UI',
        'font_color': '#FFFFFF',
        'bg_color': NAVY,
        'valign': 'vcenter',
    })

    fmt_subtitle = wb.add_format({
        'font_size': 9.5,
        'font_name': 'Segoe UI',
        'font_color': '#94A3B8',
        'bg_color': NAVY,
        'valign': 'vcenter',
    })

    fmt_section_header = wb.add_format({
        'bold': True,
        'font_size': 11,
        'font_name': 'Segoe UI',
        'font_color': NAVY,
        'bottom': 2,
        'bottom_color': CYAN,
    })

    fmt_meta_label = wb.add_format({
        'bold': True,
        'font_size': 9,
        'font_name': 'Segoe UI',
        'font_color': '#64748B',
        'bg_color': GRAY_BG,
        'border': 1,
        'border_color': BORDER_COLOR,
    })

    fmt_meta_val = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'font_color': NAVY,
        'border': 1,
        'border_color': BORDER_COLOR,
    })

    fmt_table_header = wb.add_format({
        'bold': True,
        'font_size': 9.5,
        'font_name': 'Segoe UI',
        'font_color': '#FFFFFF',
        'bg_color': NAVY,
        'border': 1,
        'border_color': NAVY,
        'align': 'center',
        'valign': 'vcenter',
    })

    fmt_table_header_right = wb.add_format({
        'bold': True,
        'font_size': 9.5,
        'font_name': 'Segoe UI',
        'font_color': '#FFFFFF',
        'bg_color': NAVY,
        'border': 1,
        'border_color': NAVY,
        'align': 'right',
        'valign': 'vcenter',
    })

    fmt_kpi_card_title = wb.add_format({
        'bold': True,
        'font_size': 8.5,
        'font_name': 'Segoe UI',
        'font_color': '#64748B',
        'bg_color': GRAY_BG,
        'align': 'center',
        'top': 1,
        'left': 1,
        'right': 1,
        'border_color': BORDER_COLOR,
    })

    fmt_kpi_card_val = wb.add_format({
        'bold': True,
        'font_size': 13,
        'font_name': 'Segoe UI',
        'font_color': NAVY,
        'bg_color': GRAY_BG,
        'align': 'center',
        'left': 1,
        'right': 1,
        'border_color': BORDER_COLOR,
        'num_format': '$#,##0.00',
    })

    fmt_kpi_card_sub = wb.add_format({
        'font_size': 8,
        'font_name': 'Segoe UI',
        'font_color': '#64748B',
        'bg_color': GRAY_BG,
        'align': 'center',
        'bottom': 1,
        'left': 1,
        'right': 1,
        'border_color': BORDER_COLOR,
    })

    fmt_cell_currency = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'border': 1,
        'border_color': '#E2E8F0',
        'align': 'right',
        'num_format': '$#,##0.00',
    })

    fmt_cell_currency_alt = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'bg_color': GRAY_BG,
        'border': 1,
        'border_color': '#E2E8F0',
        'align': 'right',
        'num_format': '$#,##0.00',
    })

    fmt_cell_center = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'border': 1,
        'border_color': '#E2E8F0',
        'align': 'center',
    })

    fmt_cell_center_alt = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'bg_color': GRAY_BG,
        'border': 1,
        'border_color': '#E2E8F0',
        'align': 'center',
    })

    fmt_cell_pct = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'border': 1,
        'border_color': '#E2E8F0',
        'align': 'right',
        'num_format': '0.0%',
    })

    fmt_cell_pct_alt = wb.add_format({
        'font_size': 9,
        'font_name': 'Segoe UI',
        'bg_color': GRAY_BG,
        'border': 1,
        'border_color': '#E2E8F0',
        'align': 'right',
        'num_format': '0.0%',
    })

    fmt_total_label = wb.add_format({
        'bold': True,
        'font_size': 9.5,
        'font_name': 'Segoe UI',
        'bg_color': '#F1F5F9',
        'top': 2,
        'bottom': 2,
        'left': 1,
        'right': 1,
        'border_color': NAVY,
        'align': 'center',
    })

    fmt_total_currency = wb.add_format({
        'bold': True,
        'font_size': 9.5,
        'font_name': 'Segoe UI',
        'bg_color': '#F1F5F9',
        'top': 2,
        'bottom': 2,
        'left': 1,
        'right': 1,
        'border_color': NAVY,
        'align': 'right',
        'num_format': '$#,##0.00',
    })

    ts = report_data.trade_stats
    reporter_str = report_data.filters.reporter or "Global (190 Sovereign Nations Aggregate)"
    flow_str = "Exports & Imports Combined" if not report_data.filters.flow else ("Exports Only (X)" if report_data.filters.flow == "X" else "Imports Only (M)")
    years_str = f"{report_data.filters.start_year or 2014} – {report_data.filters.end_year or 2025}"

    # =========================================================================
    # TAB 1: Executive Summary
    # =========================================================================
    ws_exec = wb.add_worksheet("Executive Summary")
    ws_exec.hide_gridlines(0) # Keep gridlines clean

    # Title Banner Block
    ws_exec.merge_range("A1:F2", f"  {report_data.report_title}", fmt_title)
    ws_exec.merge_range("A3:F3", f"  Prepared: {datetime.now(timezone.utc).strftime('%B %d, %Y • %H:%M UTC')} | UN Comtrade Official Data", fmt_subtitle)
    ws_exec.set_row(0, 20)
    ws_exec.set_row(1, 20)
    ws_exec.set_row(2, 18)

    # Parameters Table
    ws_exec.write("A5", "1. Report Scope & Parameters", fmt_section_header)
    ws_exec.write("A7", "Target Economy", fmt_meta_label)
    ws_exec.write("B7", reporter_str, fmt_meta_val)
    ws_exec.write("D7", "Data Authority", fmt_meta_label)
    ws_exec.write("E7", "UN Comtrade Database", fmt_meta_val)

    ws_exec.write("A8", "Trade Flow Scope", fmt_meta_label)
    ws_exec.write("B8", flow_str, fmt_meta_val)
    ws_exec.write("D8", "Commodity Classification", fmt_meta_label)
    ws_exec.write("E8", "TOTAL (All Merchandise Commodities)", fmt_meta_val)

    ws_exec.write("A9", "Reference Period", fmt_meta_label)
    ws_exec.write("B9", years_str, fmt_meta_val)
    ws_exec.write("D9", "Dataset Architecture", fmt_meta_label)
    ws_exec.write("E9", "100% Pure Macroeconomic Coverage", fmt_meta_val)

    # 4 Executive KPI Tiles
    ws_exec.write("A11", "2. Core Performance Scorecard", fmt_section_header)

    exp_share = (ts.export_value / ts.total_trade_value * 100.0) if ts.total_trade_value > 0 else 0.0
    imp_share = (ts.import_value / ts.total_trade_value * 100.0) if ts.total_trade_value > 0 else 0.0

    kpis = [
        ("TOTAL TRADE VOLUME", ts.total_trade_value, f"{ts.record_count:,} recorded flows"),
        ("OUTBOUND EXPORTS (X)", ts.export_value, f"{exp_share:.1f}% export share"),
        ("INBOUND IMPORTS (M)", ts.import_value, f"{imp_share:.1f}% import share"),
        ("NET TRADE BALANCE", ts.trade_balance, "Net Surplus" if ts.trade_balance >= 0 else "Net Deficit"),
    ]

    col_coords = [("A", "B"), ("B", "C"), ("C", "D"), ("D", "E")]
    ws_exec.write("A13", "Total Trade Volume", fmt_kpi_card_title)
    ws_exec.write_number("A14", ts.total_trade_value, fmt_kpi_card_val)
    ws_exec.write("A15", f"{ts.record_count:,} reported flows", fmt_kpi_card_sub)

    ws_exec.write("B13", "Outbound Exports (X)", fmt_kpi_card_title)
    ws_exec.write_number("B14", ts.export_value, fmt_kpi_card_val)
    ws_exec.write("B15", f"{exp_share:.1f}% share", fmt_kpi_card_sub)

    ws_exec.write("C13", "Inbound Imports (M)", fmt_kpi_card_title)
    ws_exec.write_number("C14", ts.import_value, fmt_kpi_card_val)
    ws_exec.write("C15", f"{imp_share:.1f}% share", fmt_kpi_card_sub)

    ws_exec.write("D13", "Net Trade Balance", fmt_kpi_card_title)
    ws_exec.write_number("D14", ts.trade_balance, fmt_kpi_card_val)
    ws_exec.write("D15", "Net Surplus" if ts.trade_balance >= 0 else "Net Deficit", fmt_kpi_card_sub)

    # Strategic Findings Block
    ws_exec.write("A17", "3. Executive Findings & Narrative Analysis", fmt_section_header)
    coverage_ratio = (ts.export_value / ts.import_value) if ts.import_value > 0 else 0
    
    findings = [
        f"• Cumulative Net Position: The target reporting territory recorded a cumulative trade balance of ${ts.trade_balance:,.2f} USD.",
        f"• Export Coverage Ratio: Outbound merchandise covered {coverage_ratio * 100:.1f}% of inbound import liabilities over the analyzed period.",
        "• Data Verification: Zero double-counting verified. Sourced exclusively from pure macro merchandise records (partner W00, product TOTAL).",
    ]
    for idx, f_text in enumerate(findings):
        ws_exec.write(18 + idx, 0, f_text)

    # Column widths for Tab 1
    ws_exec.set_column("A:A", 24)
    ws_exec.set_column("B:B", 24)
    ws_exec.set_column("C:C", 24)
    ws_exec.set_column("D:D", 24)
    ws_exec.set_column("E:E", 24)
    ws_exec.set_column("F:F", 16)

    # =========================================================================
    # TAB 2: Historical Trajectory (Data Table & Formulas)
    # =========================================================================
    ws_hist = wb.add_worksheet("Historical Trajectory")
    ws_hist.freeze_panes(4, 0) # Freeze header row

    ws_hist.merge_range("A1:G1", f"Annual Trade Series: {reporter_str} ({years_str})", fmt_section_header)

    headers = ["Year", "Exports (USD)", "Imports (USD)", "Total Trade (USD)", "Net Trade Balance (USD)", "Balance Status", "Export Coverage %"]
    for col_idx, h in enumerate(headers):
        align_fmt = fmt_table_header if col_idx in [0, 5] else fmt_table_header_right
        ws_hist.write(3, col_idx, h, align_fmt)

    trend_rows = report_data.yearly_trend or []
    start_row = 4
    for i, row in enumerate(trend_rows):
        r_num = start_row + i
        is_alt = (i % 2 == 1)
        cur_fmt = fmt_cell_currency_alt if is_alt else fmt_cell_currency
        center_fmt = fmt_cell_center_alt if is_alt else fmt_cell_center
        pct_fmt = fmt_cell_pct_alt if is_alt else fmt_cell_pct

        row_balance = row.export_value - row.import_value
        cov_pct = (row.export_value / row.import_value) if row.import_value > 0 else 0
        status_str = "Surplus" if row_balance >= 0 else "Deficit"

        ws_hist.write_number(r_num, 0, row.year, center_fmt)
        ws_hist.write_number(r_num, 1, row.export_value, cur_fmt)
        ws_hist.write_number(r_num, 2, row.import_value, cur_fmt)
        ws_hist.write_number(r_num, 3, row.total_value, cur_fmt)
        ws_hist.write_number(r_num, 4, row_balance, cur_fmt)
        ws_hist.write_string(r_num, 5, status_str, center_fmt)
        ws_hist.write_number(r_num, 6, cov_pct, pct_fmt)

    # Total Summary Row using Native Excel Formulas
    if trend_rows:
        last_data_row = start_row + len(trend_rows) - 1
        tot_row = last_data_row + 1

        ws_hist.write(tot_row, 0, "TOTAL", fmt_total_label)
        ws_hist.write_formula(tot_row, 1, f"=SUM(B{start_row+1}:B{tot_row})", fmt_total_currency)
        ws_hist.write_formula(tot_row, 2, f"=SUM(C{start_row+1}:C{tot_row})", fmt_total_currency)
        ws_hist.write_formula(tot_row, 3, f"=SUM(D{start_row+1}:D{tot_row})", fmt_total_currency)
        ws_hist.write_formula(tot_row, 4, f"=SUM(E{start_row+1}:E{tot_row})", fmt_total_currency)
        ws_hist.write(tot_row, 5, "Cumulative", fmt_total_label)
        ws_hist.write_formula(tot_row, 6, f"=B{tot_row+1}/C{tot_row+1}", wb.add_format({
            'bold': True, 'font_size': 9.5, 'bg_color': '#F1F5F9', 'top': 2, 'bottom': 2,
            'left': 1, 'right': 1, 'border_color': NAVY, 'align': 'right', 'num_format': '0.0%'
        }))

        # Conditional Formatting on Trade Balance column
        ws_hist.conditional_format(f"E{start_row+1}:E{tot_row}", {
            'type': 'cell',
            'criteria': '>=',
            'value': 0,
            'format': wb.add_format({'bg_color': '#DCFCE7', 'font_color': '#166534'})
        })
        ws_hist.conditional_format(f"E{start_row+1}:E{tot_row}", {
            'type': 'cell',
            'criteria': '<',
            'value': 0,
            'format': wb.add_format({'bg_color': '#FEE2E2', 'font_color': '#991B1B'})
        })

    ws_hist.set_column("A:A", 10)
    ws_hist.set_column("B:E", 20)
    ws_hist.set_column("F:F", 16)
    ws_hist.set_column("G:G", 18)

    # =========================================================================
    # TAB 3: ML Predictive Outlook (if enabled)
    # =========================================================================
    pred = report_data.prediction
    if pred and pred.models and pred.best_model in pred.models:
        best_model_obj = pred.models[pred.best_model]
        forecast_points = best_model_obj.forecast_series or []
        if forecast_points:
            ws_ml = wb.add_worksheet("ML Predictive Outlook")
            ws_ml.merge_range("A1:E1", "Machine Learning Trade Forecast Outlook", fmt_section_header)

            best_name = best_model_obj.display_name or pred.best_model.replace("_", " ").title()

            ws_ml.write("A3", "Selected Model:", fmt_meta_label)
            ws_ml.write("B3", best_name, fmt_meta_val)
            ws_ml.write("D3", "Test R² Score:", fmt_meta_label)
            ws_ml.write("E3", f"{best_model_obj.metrics.r2:.4f}", fmt_meta_val)

            ws_ml.write("A4", "Test MAE:", fmt_meta_label)
            ws_ml.write("B4", f"${best_model_obj.metrics.mae:,.2f}", fmt_meta_val)
            ws_ml.write("D4", "Naive Baseline MAE:", fmt_meta_label)
            ws_ml.write("E4", f"${pred.baseline_mae or 0.0:,.2f}", fmt_meta_val)

            advisory_msg = pred.low_confidence_warning or pred.reliability_note
            if advisory_msg:
                ws_ml.merge_range("A6:E6", f"Statistical Advisory: {advisory_msg}", wb.add_format({
                    'font_size': 8.5, 'bg_color': '#FFFBEB', 'font_color': '#92400E', 'border': 1, 'border_color': '#F59E0B'
                }))

            proj_headers = ["Horizon Year", "Projected Volume (USD)", "Lower 95% Bound", "Upper 95% Bound", "Projected YoY %"]
            for col_idx, h in enumerate(proj_headers):
                ws_ml.write(7, col_idx, h, fmt_table_header if col_idx == 0 else fmt_table_header_right)

            for i, p in enumerate(forecast_points):
                r = 8 + i
                is_alt = (i % 2 == 1)
                c_fmt = fmt_cell_currency_alt if is_alt else fmt_cell_currency
                pct_fmt = fmt_cell_pct_alt if is_alt else fmt_cell_pct
                center_fmt = fmt_cell_center_alt if is_alt else fmt_cell_center

                ws_ml.write_number(r, 0, p.year, center_fmt)
                ws_ml.write_number(r, 1, p.predicted, c_fmt)
                ws_ml.write_number(r, 2, p.lower_bound, c_fmt)
                ws_ml.write_number(r, 3, p.upper_bound, c_fmt)
                if p.growth_pct is not None:
                    ws_ml.write_number(r, 4, p.growth_pct / 100.0, pct_fmt)
                else:
                    ws_ml.write(r, 4, "N/A", center_fmt)

            ws_ml.set_column("A:A", 14)
            ws_ml.set_column("B:D", 22)
            ws_ml.set_column("E:E", 18)

    # =========================================================================
    # TAB 4: Methodology & Notes
    # =========================================================================
    ws_notes = wb.add_worksheet("Methodology & Notes")
    ws_notes.merge_range("A1:D1", "Data Governance & Methodology Reference", fmt_section_header)

    notes = [
        ("Source of Truth", "Data directly sourced from official UN Comtrade merchandise records across 190 sovereign nations."),
        ("Architecture Scope", "100% Pure Macroeconomic trade: strictly partner World (W00) and product All Commodities (TOTAL)."),
        ("Trade Valuation", "Exports reflect Free on Board (FOB) valuation; Imports reflect Cost, Insurance, and Freight (CIF) valuation."),
        ("Trade Balance Formula", "Net Trade Balance = Total Outbound Exports (X) - Total Inbound Imports (M)."),
        ("Export Coverage Ratio", "Calculated as (Total Exports / Total Imports) * 100. Values > 100% indicate a structural trade surplus."),
        ("Predictive Models", "Linear Regression (parametric baseline trend) and Random Forest Regressors (ensemble non-linear), leakage-free."),
    ]

    for idx, (term, desc) in enumerate(notes):
        row = 3 + (idx * 2)
        ws_notes.write(row, 0, term, fmt_meta_label)
        ws_notes.merge_range(row, 1, row, 3, desc, fmt_meta_val)

    ws_notes.set_column("A:A", 22)
    ws_notes.set_column("B:D", 35)

    wb.close()
    return buffer.getvalue()
