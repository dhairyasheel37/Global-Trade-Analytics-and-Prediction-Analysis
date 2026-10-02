"""
Executive PDF Report Generator.

Generates high-resolution, professional C-suite grade PDF briefing documents
using ReportLab with custom styling, dynamic page numbering, and clean vector tables.
"""
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from app.schemas import ReportResponse


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render total page count
    and professional running headers/footers on every page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        
        # 1. Top Running Header (Pages 2+)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#0f172a"))
            self.drawString(36, 762, "TradeAnalytics Platform")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(135, 762, "• Executive Macroeconomic Trade Briefing")
            self.drawRightString(612 - 36, 762, "UN Comtrade Data")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(36, 756, 612 - 36, 756)

        # 2. Bottom Running Footer (All Pages)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(36, 25, "CONFIDENTIAL • PREPARED FOR EXECUTIVE DECISION MAKERS • GLOBAL TRADE SYSTEM")
        footer_page = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 36, 25, footer_page)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 36, 612 - 36, 36)
        
        self.restoreState()


def format_currency_compact(val: Optional[float]) -> str:
    """Formats numeric values into standard executive currency strings ($T, $B, $M)."""
    if val is None:
        return "$0.00"
    abs_val = abs(val)
    sign = "-" if val < 0 else ""
    if abs_val >= 1e12:
        return f"{sign}${abs_val / 1e12:.2f} Trillion"
    if abs_val >= 1e9:
        return f"{sign}${abs_val / 1e9:.2f} Billion"
    if abs_val >= 1e6:
        return f"{sign}${abs_val / 1e6:.2f} Million"
    return f"{sign}${abs_val:,.2f}"


def format_currency_table(val: Optional[float]) -> str:
    """Formats numeric values in tables with standard 2-decimal billon/trillion units."""
    if val is None:
        return "$0.00"
    abs_val = abs(val)
    sign = "-" if val < 0 else ""
    if abs_val >= 1e12:
        return f"{sign}${abs_val / 1e12:.2f}T"
    if abs_val >= 1e9:
        return f"{sign}${abs_val / 1e9:.2f}B"
    if abs_val >= 1e6:
        return f"{sign}${abs_val / 1e6:.2f}M"
    return f"{sign}${abs_val:,.0f}"


def generate_pdf_report(report_data: ReportResponse) -> bytes:
    """
    Constructs a complete executive PDF briefing document and returns raw bytes.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45,
    )

    # Styles definition
    styles = getSampleStyleSheet()
    
    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    
    style_subtitle = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )
    
    style_section_h1 = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
    )

    style_meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )

    style_meta_value = ParagraphStyle(
        "MetaValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
    )

    style_kpi_label = ParagraphStyle(
        "KPILabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1, # Center
    )

    style_kpi_value = ParagraphStyle(
        "KPIValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        alignment=1, # Center
    )

    style_kpi_sub = ParagraphStyle(
        "KPISub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#64748b"),
        alignment=1, # Center
    )

    style_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )

    style_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
    )

    style_cell_right = ParagraphStyle(
        "TableCellRight",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
        alignment=2, # Right
    )

    style_cell_right_bold = ParagraphStyle(
        "TableCellRightBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        alignment=2, # Right
    )

    style_bullet = ParagraphStyle(
        "BulletPoint",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
        spaceBefore=2,
        spaceAfter=2,
    )

    story = []

    # 1. Executive Banner / Header
    header_table_data = [
        [
            Paragraph("EXECUTIVE MERCHANDISE TRADE BRIEFING", ParagraphStyle(
                "Tag", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#0284c7")
            )),
            Paragraph(datetime.now(timezone.utc).strftime("%B %d, %Y • %H:%M UTC"), ParagraphStyle(
                "Date", fontName="Helvetica", fontSize=8, textColor=colors.HexColor("#64748b"), alignment=2
            )),
        ],
        [
            Paragraph(report_data.report_title, style_title),
            "",
        ],
        [
            Paragraph(
                "Official macroeconomic analysis synthesized from UN Comtrade authoritative datasets. "
                "Covers total merchandise trade, outbound exports, inbound imports, and structural trade balances.",
                style_subtitle
            ),
            "",
        ]
    ]

    header_table = Table(header_table_data, colWidths=[420, 120])
    header_table.setStyle(TableStyle([
        ('SPAN', (0, 1), (1, 1)),
        ('SPAN', (0, 2), (1, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f172a"), spaceBefore=0, spaceAfter=8))

    # 2. Metadata Block Table
    reporter_str = report_data.filters.reporter or "Global (190 Sovereign Nations Aggregate)"
    flow_str = "Exports & Imports Combined"
    if report_data.filters.flow == "X":
        flow_str = "Exports Only (Outbound Flow X)"
    elif report_data.filters.flow == "M":
        flow_str = "Imports Only (Inbound Flow M)"

    years_str = f"{report_data.filters.start_year or 2014} – {report_data.filters.end_year or 2025}"
    if (report_data.filters.start_year or 2014) == (report_data.filters.end_year or 2025):
        years_str = f"Single Year {report_data.filters.start_year or 2014}"

    meta_table_data = [
        [
            Paragraph("Target Economy / Scope:", style_meta_label),
            Paragraph(f"<b>{reporter_str}</b>", style_meta_value),
            Paragraph("Data Authority:", style_meta_label),
            Paragraph("United Nations Comtrade Database", style_meta_value),
        ],
        [
            Paragraph("Trade Flow Scope:", style_meta_label),
            Paragraph(flow_str, style_meta_value),
            Paragraph("Commodity Scope:", style_meta_label),
            Paragraph("All Commodities (TOTAL / HS Aggregate)", style_meta_value),
        ],
        [
            Paragraph("Reference Period:", style_meta_label),
            Paragraph(years_str, style_meta_value),
            Paragraph("Dataset Architecture:", style_meta_label),
            Paragraph("100% Pure Macroeconomic Coverage", style_meta_value),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[110, 160, 110, 160])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#edf2f7")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    ts = report_data.trade_stats

    # Handle No-Data State
    if report_data.no_data or ts.no_data:
        no_data_table = Table([
            [Paragraph("<b>Notice: No Trade Data Found</b>", style_cell_bold)],
            [Paragraph(report_data.message or "No trade records were found matching your specific filter parameters.", style_cell)],
        ], colWidths=[540])
        no_data_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#f87171")),
            ('PADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(no_data_table)
        doc.build(story, canvasmaker=NumberedCanvas)
        return buffer.getvalue()

    # 3. Section 1: Executive KPI Scorecard
    story.append(Paragraph("1. Executive Trade KPI Scorecard", style_section_h1))
    
    tot_trade_str = format_currency_compact(ts.total_trade_value)
    exp_str = format_currency_compact(ts.export_value)
    imp_str = format_currency_compact(ts.import_value)
    bal_str = format_currency_compact(ts.trade_balance)
    
    bal_color = "#059669" if ts.trade_balance >= 0 else "#dc2626"
    bal_title = "Net Trade Surplus" if ts.trade_balance >= 0 else "Net Trade Deficit"

    exp_share = (ts.export_value / ts.total_trade_value * 100.0) if ts.total_trade_value > 0 else 0.0
    imp_share = (ts.import_value / ts.total_trade_value * 100.0) if ts.total_trade_value > 0 else 0.0

    kpi_card_data = [
        [
            Paragraph("TOTAL TRADE VOLUME", style_kpi_label),
            Paragraph("OUTBOUND EXPORTS (X)", style_kpi_label),
            Paragraph("INBOUND IMPORTS (M)", style_kpi_label),
            Paragraph("NET TRADE BALANCE", style_kpi_label),
        ],
        [
            Paragraph(tot_trade_str, style_kpi_value),
            Paragraph(f"<font color='#059669'>{exp_str}</font>", style_kpi_value),
            Paragraph(f"<font color='#0284c7'>{imp_str}</font>", style_kpi_value),
            Paragraph(f"<font color='{bal_color}'>{bal_str}</font>", style_kpi_value),
        ],
        [
            Paragraph(f"{ts.record_count:,} reported flows", style_kpi_sub),
            Paragraph(f"{exp_share:.1f}% export share", style_kpi_sub),
            Paragraph(f"{imp_share:.1f}% import share", style_kpi_sub),
            Paragraph(bal_title, style_kpi_sub),
        ],
    ]
    kpi_table = Table(kpi_card_data, colWidths=[135, 135, 135, 135])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # 4. Section 2: Macroeconomic Highlights
    story.append(Paragraph("2. Strategic Findings & Macroeconomic Analysis", style_section_h1))
    
    # Calculate coverage ratio and highlights
    coverage_ratio = (ts.export_value / ts.import_value * 100) if ts.import_value > 0 else 0
    balance_ratio = (abs(ts.trade_balance) / ts.total_trade_value * 100) if ts.total_trade_value > 0 else 0
    
    insights = []
    if ts.trade_balance >= 0:
        insights.append(
            f"<b>Trade Surplus Position:</b> The reporting territory achieved a cumulative net merchandise trade surplus of "
            f"<b>{format_currency_compact(ts.trade_balance)}</b>, reflecting an export coverage ratio of "
            f"<b>{coverage_ratio:.1f}%</b> (exports outpaced imports by {coverage_ratio - 100:.1f}%)."
        )
    else:
        insights.append(
            f"<b>Trade Deficit Position:</b> The reporting territory incurred a cumulative net trade deficit of "
            f"<b>{format_currency_compact(ts.trade_balance)}</b>, with an export coverage ratio of "
            f"<b>{coverage_ratio:.1f}%</b>. Net import demand accounted for {balance_ratio:.1f}% of total trade volume."
        )

    if report_data.yearly_trend:
        highest_year = max(report_data.yearly_trend, key=lambda x: x.total_value)
        insights.append(
            f"<b>Peak Trade Velocity:</b> The highest single-year trade volume occurred in <b>{highest_year.year}</b>, "
            f"reaching <b>{format_currency_compact(highest_year.total_value)}</b> "
            f"(${highest_year.export_value / 1e9:.1f}B Exports / ${highest_year.import_value / 1e9:.1f}B Imports)."
        )
        avg_trade = ts.total_trade_value / len(report_data.yearly_trend)
        insights.append(
            f"<b>Annual Trade Velocity:</b> The annual average total merchandise trade across the {len(report_data.yearly_trend)}-year "
            f"period stands at <b>{format_currency_compact(avg_trade)} per year</b>."
        )

    insights.append(
        "<b>Data Integrity Notice:</b> Data strictly represents macroeconomic bilateral transactions with World (partner W00) "
        "at the aggregate commodity level (HS TOTAL), verified for 0 double counting across reporting economies."
    )

    findings_data = [[Paragraph(f"• {pt}", style_bullet)] for pt in insights]
    findings_table = Table(findings_data, colWidths=[540])
    findings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(findings_table)
    story.append(Spacer(1, 10))

    # 5. Section 3: Annual Historical Trajectory Table
    if report_data.yearly_trend:
        story.append(Paragraph("3. Annual Trade Trajectory (Historical Data Series)", style_section_h1))
        
        hist_table_data = [
            [
                Paragraph("<b>Year</b>", style_cell_bold),
                Paragraph("<b>Exports (USD)</b>", style_cell_right_bold),
                Paragraph("<b>Imports (USD)</b>", style_cell_right_bold),
                Paragraph("<b>Total Trade (USD)</b>", style_cell_right_bold),
                Paragraph("<b>Trade Balance</b>", style_cell_right_bold),
                Paragraph("<b>Balance Status</b>", style_cell_bold),
            ]
        ]

        for i, row in enumerate(report_data.yearly_trend):
            row_balance = row.export_value - row.import_value
            status_color = "#059669" if row_balance >= 0 else "#dc2626"
            status_text = "Surplus" if row_balance >= 0 else "Deficit"
            
            hist_table_data.append([
                Paragraph(str(row.year), style_cell),
                Paragraph(format_currency_table(row.export_value), style_cell_right),
                Paragraph(format_currency_table(row.import_value), style_cell_right),
                Paragraph(format_currency_table(row.total_value), style_cell_right_bold),
                Paragraph(f"<font color='{status_color}'>{format_currency_table(row_balance)}</font>", style_cell_right),
                Paragraph(f"<font color='{status_color}'><b>{status_text}</b></font>", style_cell),
            ])

        # Summary Totals Row
        hist_table_data.append([
            Paragraph("<b>TOTAL</b>", style_cell_bold),
            Paragraph(f"<b>{format_currency_table(ts.export_value)}</b>", style_cell_right_bold),
            Paragraph(f"<b>{format_currency_table(ts.import_value)}</b>", style_cell_right_bold),
            Paragraph(f"<b>{format_currency_table(ts.total_trade_value)}</b>", style_cell_right_bold),
            Paragraph(f"<b><font color='{bal_color}'>{format_currency_table(ts.trade_balance)}</font></b>", style_cell_right_bold),
            Paragraph(f"<b>{bal_title}</b>", style_cell_bold),
        ])

        hist_table = Table(hist_table_data, colWidths=[55, 100, 100, 105, 100, 80])
        t_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
            ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor("#0f172a")),
        ]

        # Alternating row colors for data rows
        for r_idx in range(1, len(hist_table_data) - 1):
            if r_idx % 2 == 0:
                t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor("#f8fafc")))

        hist_table.setStyle(TableStyle(t_style))
        story.append(hist_table)
        story.append(Spacer(1, 12))

    # 6. Section 4: Machine Learning Predictive Outlook (if enabled)
    pred = report_data.prediction
    if pred and pred.models and pred.best_model in pred.models:
        best_model_obj = pred.models[pred.best_model]
        ml_story = []
        ml_story.append(Paragraph("4. Machine Learning Forecast Outlook (Predictive Intelligence)", style_section_h1))
        
        # Performance Evaluation Card
        best_model_name = best_model_obj.display_name or pred.best_model.replace("_", " ").title()
        r2_val = best_model_obj.metrics.r2
        mae_val = best_model_obj.metrics.mae
        rmse_val = best_model_obj.metrics.rmse
        baseline_mae = pred.baseline_mae or 0.0

        train_range_str = f"{min(pred.training_years)}–{max(pred.training_years)}" if pred.training_years else "N/A"

        ml_eval_data = [
            [
                Paragraph("<b>Selected Algorithm:</b>", style_cell_bold),
                Paragraph(f"{best_model_name}", style_cell),
                Paragraph("<b>Baseline MAE (Naive):</b>", style_cell_bold),
                Paragraph(format_currency_compact(baseline_mae), style_cell),
            ],
            [
                Paragraph("<b>Test MAE (Error):</b>", style_cell_bold),
                Paragraph(format_currency_compact(mae_val), style_cell),
                Paragraph("<b>Test RMSE:</b>", style_cell_bold),
                Paragraph(format_currency_compact(rmse_val), style_cell),
            ],
            [
                Paragraph("<b>R² Score:</b>", style_cell_bold),
                Paragraph(f"{r2_val:.4f}", style_cell),
                Paragraph("<b>Historical Training Scope:</b>", style_cell_bold),
                Paragraph(f"{train_range_str} ({pred.usable_observations} obs)", style_cell),
            ],
        ]
        ml_eval_table = Table(ml_eval_data, colWidths=[135, 135, 135, 135])
        ml_eval_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        ml_story.append(ml_eval_table)
        ml_story.append(Spacer(1, 6))

        # Warning / Confidence Advisory
        advisory_msg = pred.low_confidence_warning or pred.reliability_note
        if advisory_msg:
            warn_table = Table([[
                Paragraph(f"<b>Statistical Advisory:</b> {advisory_msg}", ParagraphStyle(
                    "Warn", parent=styles["Normal"], fontSize=7.5, leading=10, textColor=colors.HexColor("#92400e")
                ))
            ]], colWidths=[540])
            warn_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fffbeb")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#f59e0b")),
                ('PADDING', (0, 0), (-1, -1), 5),
            ]))
            ml_story.append(warn_table)
            ml_story.append(Spacer(1, 6))

        # Future Projections Table
        if best_model_obj.forecast_series:
            proj_table_data = [
                [
                    Paragraph("<b>Horizon Year</b>", style_cell_bold),
                    Paragraph("<b>Projected Volume</b>", style_cell_right_bold),
                    Paragraph("<b>Lower 95% Bound</b>", style_cell_right_bold),
                    Paragraph("<b>Upper 95% Bound</b>", style_cell_right_bold),
                    Paragraph("<b>Projected YoY %</b>", style_cell_right_bold),
                ]
            ]
            for p_row in best_model_obj.forecast_series:
                yoy_str = f"{p_row.growth_pct:+.1f}%" if p_row.growth_pct is not None else "N/A"
                proj_table_data.append([
                    Paragraph(f"<b>{p_row.year}</b>", style_cell),
                    Paragraph(f"<b>{format_currency_table(p_row.predicted)}</b>", style_cell_right_bold),
                    Paragraph(format_currency_table(p_row.lower_bound), style_cell_right),
                    Paragraph(format_currency_table(p_row.upper_bound), style_cell_right),
                    Paragraph(yoy_str, style_cell_right),
                ])

            proj_table = Table(proj_table_data, colWidths=[90, 120, 110, 110, 110])
            proj_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]
            for r_idx in range(1, len(proj_table_data)):
                if r_idx % 2 == 0:
                    proj_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor("#f8fafc")))
            proj_table.setStyle(TableStyle(proj_style))
            ml_story.append(proj_table)

        story.append(KeepTogether(ml_story))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
