from typing import Optional, List, Dict, Union
from datetime import datetime
from pydantic import BaseModel, ConfigDict

# --- System & Health Schemas ---
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str
    total_records: int

# --- Auth & User Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    createdAt: Optional[Union[datetime, str]] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class LogoutResponse(BaseModel):
    message: str

class AdminPingResponse(BaseModel):
    message: str
    admin_user: str
    role: str

# --- Trade Data Schemas ---
class YearRange(BaseModel):
    min: Optional[int] = None
    max: Optional[int] = None

class UniqueCounts(BaseModel):
    reporters: int
    partners: int
    products: int
    flows: int

class DataSummaryResponse(BaseModel):
    total_records: int
    year_range: YearRange
    unique_counts: UniqueCounts
    missing_values: Dict[str, int]
    exact_duplicate_count: int
    negative_value_count: int


# --- Phase 9: Data Management Schemas ---

class MissingColumnDetail(BaseModel):
    column: str
    missing_count: int
    total_records: int
    missing_percentage: float
    is_critical: bool
    field_label: Optional[str] = None
    description: Optional[str] = None


class DataQualitySummary(BaseModel):
    total_issues: int
    columns_with_missing: int
    total_missing_cells: int
    has_duplicates: bool
    duplicate_count: int
    health_status: str  # "GOOD" | "WARNINGS" | "ISSUES"
    health_label: str = "Healthy"
    critical_missing_cells: int = 0
    optional_missing_cells: int = 0
    missing_cell_percentage: float = 0.0
    total_active_cells: int = 87786


class DataOverviewResponse(BaseModel):
    record_count: int
    column_count: int
    year_range: YearRange
    unique_reporters: int
    unique_partners: int
    unique_products: int
    unique_flows: int
    missing_values: Dict[str, int]
    duplicate_record_count: int
    data_quality_summary: DataQualitySummary

    # Strict Granular & Scope metrics
    total_active_records: int = 4877
    total_active_cells: int = 87786
    baseline_records: int = 3925
    granular_bilateral_records: int = 952
    granular_reporter_count: int = 4
    granular_reporters: List[str] = []
    aggregate_only_reporter_count: int = 186
    granular_partner_count: int = 5
    granular_partners: List[str] = []
    granular_product_count: int = 4
    granular_products: List[str] = []
    has_aggregate_product: bool = True
    aggregate_product_label: str = "TOTAL (All Commodities)"
    missing_details: List[MissingColumnDetail] = []
    critical_missing_details: List[MissingColumnDetail] = []
    optional_missing_details: List[MissingColumnDetail] = []
    scope_notice: Optional[str] = None


class RejectionDetail(BaseModel):
    reason: str
    count: int
    row_indices: List[int]  # 1-based row numbers in the uploaded file


class UploadResponse(BaseModel):
    filename: str
    records_read: int
    new_records_inserted: int
    existing_records_skipped: int
    invalid_records_rejected: int
    rejection_details: List[RejectionDetail]
    success: bool
    message: str

class TradeRecordSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    refYear: int
    reporterISO: str
    reporterDesc: str
    flowCode: str
    flowDesc: str
    partnerISO: str
    partnerDesc: str
    cmdCode: str
    cmdDesc: str
    aggrLevel: Optional[int] = 0
    isLeaf: Optional[bool] = False
    qty: Optional[float] = None
    netWgt: Optional[float] = None
    grossWgt: Optional[float] = None
    cifvalue: Optional[float] = None
    fobvalue: Optional[float] = None
    primaryValue: float
    tradeValue: Optional[float] = None
    createdAt: Optional[Union[datetime, str]] = None

class SampleResponse(BaseModel):
    total_records: int
    limit: int
    offset: int
    returned_count: int
    records: List[TradeRecordSchema]

# --- Dashboard Schemas ---
class DashboardKPIsResponse(BaseModel):
    total_trade_value: float
    total_export: float
    total_import: float
    trade_balance: float
    trade_balance_status: str  # "Trade Surplus" | "Trade Deficit" | "Balanced Trade"
    num_countries: int
    num_records: int
    no_data: bool = False

class YearlyTradeData(BaseModel):
    year: int
    total_trade_value: float

class YearlyImportExportData(BaseModel):
    year: int
    import_value: float
    export_value: float
    total_value: float

class TopReporterData(BaseModel):
    reporter_iso: str
    reporter_desc: str
    total_value: float
    export_value: float
    import_value: float

class FlowDistributionData(BaseModel):
    flow: str
    flow_code: str
    value: float
    percentage: float

class YearlyTradeBalanceData(BaseModel):
    year: int
    trade_balance: float
    export_value: float
    import_value: float
    status: str

class ReporterOption(BaseModel):
    iso: str
    desc: str

class FlowOption(BaseModel):
    code: str
    desc: str

class PartnerOption(BaseModel):
    iso: str
    desc: str

class ProductOption(BaseModel):
    code: str
    desc: str

class FilterOptionsResponse(BaseModel):
    reporters: List[ReporterOption]
    years: List[int]
    flows: List[FlowOption]
    partners: List[PartnerOption] = []
    products: List[ProductOption] = []

class ScopeNoticeResponse(BaseModel):
    granular_reporters_count: int
    granular_reporters: List[str]
    aggregate_only_reporters_count: int
    total_reporters_count: int
    distinct_partners_count: int
    distinct_partners: List[str]
    distinct_products_count: int
    distinct_products: List[str]
    notice: str

# --- Trade Analysis Schemas (Phase 4) ---
class TradeAnalysisStatsResponse(BaseModel):
    total_trade_value: float
    average_trade_value: float
    min_trade_value: float
    max_trade_value: float
    record_count: int
    export_value: float
    import_value: float
    trade_balance: float
    no_data: bool = False

class PaginatedTradeRecordsResponse(BaseModel):
    records: List[TradeRecordSchema]
    total_count: int
    page: int
    page_size: int
    total_pages: int

# --- Country Analysis Schemas (Phase 5) ---
class CountryProfileResponse(BaseModel):
    reporter_iso: str
    reporter_name: str
    total_exports: float
    total_imports: float
    total_trade_value: float
    trade_balance: float
    trade_balance_status: str  # "Trade Surplus" | "Trade Deficit" | "Balanced Trade"
    export_growth: Optional[float] = None
    import_growth: Optional[float] = None
    growth_note: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    no_data: bool = False

class CountryYearlyTrend(BaseModel):
    year: int
    export_value: float
    import_value: float
    total_value: float
    trade_balance: float

class TopPartnerItem(BaseModel):
    partner_iso: str
    partner_desc: str
    trade_value: float
    export_value: float
    import_value: float
    share_percentage: float

class TopProductItem(BaseModel):
    cmd_code: str
    cmd_desc: str
    trade_value: float
    export_value: float
    import_value: float
    share_percentage: float

class CountryPartnersResponse(BaseModel):
    reporter_iso: str
    reporter_name: str
    has_granular_data: bool
    message: Optional[str] = None
    partners: List[TopPartnerItem] = []

class CountryProductsResponse(BaseModel):
    reporter_iso: str
    reporter_name: str
    has_granular_data: bool
    message: Optional[str] = None
    products: List[TopProductItem] = []

# --- Product Analysis Schemas (Phase 6) ---
class ProductListItem(BaseModel):
    cmd_code: str
    cmd_desc: str
    total_records: int

class ProductProfileResponse(BaseModel):
    cmd_code: str
    cmd_desc: str
    total_exports: float
    total_imports: float
    total_trade_value: float
    trade_balance: float
    trade_balance_status: str
    export_growth: Optional[float] = None
    import_growth: Optional[float] = None
    growth_note: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    no_data: bool = False

class ProductYearlyTrend(BaseModel):
    year: int
    export_value: float
    import_value: float
    total_value: float
    trade_balance: float

class ProductTopCountryItem(BaseModel):
    reporter_iso: str
    reporter_desc: str
    trade_value: float
    share_percentage: float

# --- Trade Balance Schemas (Phase 7) ---
class TradeBalanceSummaryResponse(BaseModel):
    reporter: str
    total_export: float
    total_import: float
    total_trade_value: float
    trade_balance: float
    trade_balance_status: str  # "Trade Surplus" | "Trade Deficit" | "Balanced Trade"
    start_year: int
    end_year: int
    no_data: bool = False

class TradeBalanceYearlyItem(BaseModel):
    year: int
    export_value: float
    import_value: float
    total_value: float
    trade_balance: float
    status: str

class CountryBalanceCompareItem(BaseModel):
    reporter_iso: str
    reporter_desc: str
    total_export: float
    total_import: float
    total_trade: float
    trade_balance: float
    status: str

# --- Machine Learning Prediction Schemas (Phase 8) ---
class ModelMetrics(BaseModel):
    mae: float
    rmse: float
    r2: float
    mape: float

class HistoricalPoint(BaseModel):
    year: int
    actual: float

class BacktestPoint(BaseModel):
    year: int
    actual: float
    predicted: float

class ForecastPoint(BaseModel):
    year: int
    predicted: float
    lower_bound: float
    upper_bound: float
    growth_pct: Optional[float] = None

class FeatureImportance(BaseModel):
    feature_name: str
    importance_score: float

class ModelResult(BaseModel):
    model_name: str
    display_name: str
    metrics: ModelMetrics
    backtest_series: List[BacktestPoint]
    forecast_series: List[ForecastPoint]
    feature_importance: List[FeatureImportance]

class PredictionRequest(BaseModel):
    reporter: str = "USA"
    flow: str = "X"  # 'X' (Export), 'M' (Import), or 'TOTAL'
    forecast_years: int = 3
    start_year: Optional[int] = None
    end_year: Optional[int] = None

class PredictionResponse(BaseModel):
    reporter: str
    reporter_name: str
    flow: str
    flow_desc: str
    usable_observations: int
    required_observations: int = 8
    training_years: List[int]
    test_years: List[int]
    best_model: str
    baseline_mae: float
    low_confidence_warning: Optional[str] = None
    historical_series: List[HistoricalPoint]
    models: Dict[str, ModelResult]
    reliability_note: str
    success: bool = True
    error_message: Optional[str] = None


# --- Phase 10: Automated Reports Schemas ---

class ReportGenerateRequest(BaseModel):
    reporter: Optional[str] = None
    flow: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    include_prediction: bool = False
    forecast_years: int = 3


class ReportFilters(BaseModel):
    reporter: Optional[str] = None
    flow: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    include_prediction: bool = False
    forecast_years: int = 3


class ReportResponse(BaseModel):
    report_title: str
    generated_at: str
    filters: ReportFilters
    no_data: bool = False
    message: Optional[str] = None
    trade_stats: Optional[TradeAnalysisStatsResponse] = None
    country_profile: Optional[CountryProfileResponse] = None
    product_profile: Optional[ProductProfileResponse] = None
    prediction: Optional[PredictionResponse] = None
    yearly_trend: Optional[List[YearlyImportExportData]] = None


# --- Phase 11: About Project Schemas ---

class AboutYearRange(BaseModel):
    start_year: Optional[int] = None
    end_year: Optional[int] = None


class AboutDatasetStatsResponse(BaseModel):
    total_records: int
    year_range: AboutYearRange
    reporter_count: int
    flow_count: int
    product_count: int
    partner_count: int


# --- Country Comparison Schemas ---

class CountrySideComparison(BaseModel):
    iso: str
    name: str
    exports: float
    imports: float
    totalTrade: float
    tradeBalance: float
    tradeBalanceStatus: str
    exportGrowth: Optional[float] = None
    importGrowth: Optional[float] = None
    partnerCount: Optional[int] = None
    commodityCount: Optional[int] = None
    hasGranularData: bool
    partnerDataMessage: Optional[str] = None
    partners: List[TopPartnerItem] = []
    commodities: List[TopProductItem] = []
    yearly: List[CountryYearlyTrend] = []


class DifferenceMetrics(BaseModel):
    direction: str = "Country A - Country B"
    exportsDiff: float
    importsDiff: float
    totalTradeDiff: float
    tradeBalanceDiff: float


class CommonCommodityItem(BaseModel):
    cmdCode: str
    cmdDesc: str
    countryAValue: float
    countryBValue: float
    diffValue: float
    countryAExport: float = 0.0
    countryBExport: float = 0.0
    countryAImport: float = 0.0
    countryBImport: float = 0.0


class CommonCommoditiesComparison(BaseModel):
    isAvailable: bool
    message: Optional[str] = None
    items: List[CommonCommodityItem] = []


class CountryComparisonResponse(BaseModel):
    countryA: CountrySideComparison
    countryB: CountrySideComparison
    difference: DifferenceMetrics
    commonCommodities: CommonCommoditiesComparison
    start_year: Optional[int] = None
    end_year: Optional[int] = None


# --- Geospatial World Map Schemas ---

class MapCountryItem(BaseModel):
    iso_code: str
    country_name: str
    exports: float
    imports: float
    total_trade: float
    trade_balance: float
    trade_balance_status: str  # "Trade Surplus" | "Trade Deficit" | "Balanced Trade"
    has_granular_data: bool = False


class MapSummaryMetrics(BaseModel):
    total_global_trade: float
    total_global_exports: float
    total_global_imports: float
    global_trade_balance: float
    countries_with_data: int
    granular_countries_count: int


class MapDataResponse(BaseModel):
    year: Optional[int] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    available_years: List[int] = []
    summary: MapSummaryMetrics
    countries: List[MapCountryItem] = []


# --- Phase 14: Economic Metrics & Specialized Indices Schemas ---

class CountryEconomicIndices(BaseModel):
    reporter_iso: str
    reporter_name: str
    export_value: float
    import_value: float
    total_trade_value: float
    trade_balance: float
    tbi: float  # Lafay Trade Balance Index [-100, +100]
    rta: float  # Revealed Trade Advantage ratio
    gli: float  # Grubel-Lloyd Macro Trade Overlap Index [0.0, 1.0]
    export_market_share: float  # % of global exports
    import_market_share: float  # % of global imports
    trade_openness_share: float  # % of global trade
    rank_by_volume: int


class GlobalEconomicMetricsResponse(BaseModel):
    year_label: str
    total_global_exports: float
    total_global_imports: float
    total_global_trade: float
    hhi_export_concentration: float
    hhi_status: str
    top_exporter_iso: str
    top_exporter_name: str
    top_exporter_share: float
    mean_global_tbi: float
    countries_count: int
    indices: List[CountryEconomicIndices]


class HeatmapCell(BaseModel):
    country_iso: str
    country_name: str
    year: int
    value: float
    display_value: str
    export_val: float
    import_val: float
    balance_val: float


class HeatmapCountryRow(BaseModel):
    country_iso: str
    country_name: str
    avg_value: float
    latest_value: float
    total_volume: float
    cells: List[HeatmapCell]


class HeatmapMatrixResponse(BaseModel):
    metric: str
    metric_title: str
    metric_description: str
    color_scale_type: str  # "diverging" | "sequential"
    unit: str
    years: List[int]
    min_value: float
    max_value: float
    neutral_value: float
    countries: List[HeatmapCountryRow]


class CorrelationMatrixResponse(BaseModel):
    countries: List[ReporterOption]
    metric: str
    matrix: List[List[float]]


class BilateralDirectedFlow(BaseModel):
    exporter_iso: str
    exporter_name: str
    importer_iso: str
    importer_name: str
    export_value: float
    import_value: float
    net_balance: float


class BilateralMatrixResponse(BaseModel):
    countries: List[ReporterOption]
    metric_title: str
    matrix: List[List[float]]
    pairs: List[BilateralDirectedFlow]


