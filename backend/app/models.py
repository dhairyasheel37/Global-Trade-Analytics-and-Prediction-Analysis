from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Index,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    """
    SQLAlchemy model representing an application user with role-based authorization.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="USER")  # "ADMIN" or "USER"
    createdAt = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "createdAt": self.createdAt.isoformat() if self.createdAt else None,
        }


class TradeRecord(Base):
    """
    SQLAlchemy model representing a single global trade observation record.
    Matches UN Comtrade-style schema with exact data typing and composite indexing.
    """
    __tablename__ = "trade_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    refYear = Column(Integer, nullable=False, doc="Reference year of the trade data")
    reporterISO = Column(String(10), nullable=False, doc="ISO 3-letter code of reporting country")
    reporterDesc = Column(String(255), nullable=False, doc="Full name of reporting country")
    flowCode = Column(String(5), nullable=False, doc="Trade flow code (e.g. 'M' for Import, 'X' for Export)")
    flowDesc = Column(String(50), nullable=False, doc="Trade flow description ('Import', 'Export')")
    partnerISO = Column(String(10), nullable=False, doc="ISO code of partner (e.g. 'W00' for World)")
    partnerDesc = Column(String(255), nullable=False, doc="Partner name ('World')")
    cmdCode = Column(String(20), nullable=False, doc="Commodity/Product classification code ('TOTAL')")
    cmdDesc = Column(String(255), nullable=False, doc="Commodity description ('All Commodities')")
    aggrLevel = Column(Integer, nullable=True, default=0, doc="Aggregation level (0 for total)")
    isLeaf = Column(Boolean, nullable=True, default=False, doc="Is leaf commodity flag")
    qty = Column(Float, nullable=True, doc="Quantity traded (genuine 0 or NULL)")
    netWgt = Column(Float, nullable=True, doc="Net weight in kg (genuine 0 or NULL)")
    grossWgt = Column(Float, nullable=True, doc="Gross weight in kg (genuine 0 or NULL)")
    cifvalue = Column(Float, nullable=True, doc="Cost, Insurance, and Freight value in USD (genuine 0 or NULL)")
    fobvalue = Column(Float, nullable=True, doc="Free on Board value in USD (genuine 0 or NULL)")
    primaryValue = Column(Float, nullable=False, doc="Primary trade value in USD")
    tradeValue = Column(Float, nullable=True, doc="Reported trade value in USD")
    createdAt = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index(
            "idx_trade_dedup",
            "refYear",
            "reporterISO",
            "partnerISO",
            "flowCode",
            "cmdCode",
        ),
    )

    def to_dict(self) -> dict:
        """Converts the record to a dictionary representation."""
        return {
            "id": self.id,
            "refYear": self.refYear,
            "reporterISO": self.reporterISO,
            "reporterDesc": self.reporterDesc,
            "flowCode": self.flowCode,
            "flowDesc": self.flowDesc,
            "partnerISO": self.partnerISO,
            "partnerDesc": self.partnerDesc,
            "cmdCode": self.cmdCode,
            "cmdDesc": self.cmdDesc,
            "aggrLevel": self.aggrLevel,
            "isLeaf": self.isLeaf,
            "qty": self.qty,
            "netWgt": self.netWgt,
            "grossWgt": self.grossWgt,
            "cifvalue": self.cifvalue,
            "fobvalue": self.fobvalue,
            "primaryValue": self.primaryValue,
            "tradeValue": self.tradeValue,
            "createdAt": self.createdAt.isoformat() if self.createdAt else None,
        }


class Country(Base):
    """
    Reference table for sovereign reporting economies and partner territories.
    """
    __tablename__ = "countries"

    country_id = Column(Integer, primary_key=True, autoincrement=True)
    iso_code = Column(String(10), unique=True, nullable=False, index=True)
    country_name = Column(String(255), nullable=False)

    def to_dict(self) -> dict:
        return {
            "country_id": self.country_id,
            "iso_code": self.iso_code,
            "country_name": self.country_name,
        }


class Product(Base):
    """
    Reference table for product / commodity classifications.
    """
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, autoincrement=True)
    product_code = Column(String(20), unique=True, nullable=False, index=True)
    product_name = Column(String(255), nullable=False)
    product_level = Column(String(50), nullable=False)

    def to_dict(self) -> dict:
        return {
            "product_id": self.product_id,
            "product_code": self.product_code,
            "product_name": self.product_name,
            "product_level": self.product_level,
        }


class TradeRecordV2(Base):
    """
    Normalized trade observation record supporting granular partner and product dimensions.
    """
    __tablename__ = "trade_records_v2"

    id = Column(Integer, primary_key=True, autoincrement=True)
    year = Column(Integer, nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("countries.country_id"), nullable=False, index=True)
    partner_id = Column(Integer, ForeignKey("countries.country_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    flow_code = Column(String(10), nullable=False, index=True)
    flow_name = Column(String(50), nullable=True)
    primary_value = Column(Float, nullable=False)
    fob_value = Column(Float, nullable=True)
    cif_value = Column(Float, nullable=True)
    quantity = Column(Float, nullable=True)
    source = Column(String(50), default="UN_COMTRADE", nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_reported = Column(Boolean, default=False, nullable=True)
    is_aggregate = Column(Boolean, default=True, nullable=True)
    legacy_estimation_flag = Column(Integer, default=0, nullable=True)

    reporter = relationship("Country", foreign_keys=[reporter_id])
    partner = relationship("Country", foreign_keys=[partner_id])
    product = relationship("Product", foreign_keys=[product_id])

    __table_args__ = (
        Index(
            "idx_tr_v2_composite",
            "year",
            "reporter_id",
            "partner_id",
            "product_id",
            "flow_code",
        ),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "year": self.year,
            "reporter_id": self.reporter_id,
            "partner_id": self.partner_id,
            "product_id": self.product_id,
            "flow_code": self.flow_code,
            "flow_name": self.flow_name,
            "primary_value": self.primary_value,
            "fob_value": self.fob_value,
            "cif_value": self.cif_value,
            "quantity": self.quantity,
            "source": self.source,
            "is_reported": self.is_reported,
            "is_aggregate": self.is_aggregate,
            "legacy_estimation_flag": self.legacy_estimation_flag,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DataSyncLog(Base):
    """
    SQLAlchemy model tracking automated and manual trade data sync executions.
    """
    __tablename__ = "data_sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sync_type = Column(String(50), nullable=False)     # "API_PULL", "SCHEDULED_CRON", "CSV_UPLOAD"
    status = Column(String(20), nullable=False)        # "RUNNING", "SUCCESS", "FAILED"
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    records_processed = Column(Integer, default=0, nullable=False)
    records_inserted = Column(Integer, default=0, nullable=False)
    records_skipped = Column(Integer, default=0, nullable=False)
    records_rejected = Column(Integer, default=0, nullable=False)
    source_name = Column(String(255), nullable=True)   # "UN_COMTRADE_API_V1", filename, etc.
    error_message = Column(String(1000), nullable=True)
    details = Column(String(2000), nullable=True)      # JSON formatted execution metadata

    def to_dict(self) -> dict:
        duration_sec = None
        if self.started_at and self.completed_at:
            duration_sec = round((self.completed_at - self.started_at).total_seconds(), 2)

        return {
            "id": self.id,
            "sync_type": self.sync_type,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": duration_sec,
            "records_processed": self.records_processed,
            "records_inserted": self.records_inserted,
            "records_skipped": self.records_skipped,
            "records_rejected": self.records_rejected,
            "source_name": self.source_name,
            "error_message": self.error_message,
            "details": self.details,
        }

