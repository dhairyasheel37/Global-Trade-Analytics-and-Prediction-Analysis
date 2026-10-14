"""
Automated Data Sync Engine & Background Scheduler.
Handles scheduled cron runs and on-demand synchronization with UN Comtrade API,
ensuring duplicate prevention, transactional persistence, and detailed audit logging.
"""
from __future__ import annotations

import asyncio
import json
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import TradeRecordV2, TradeRecord, Country, Product, DataSyncLog
from app.services.comtrade_client import ComtradeAPIClient
from app.utils.logger import logger


class DataSyncService:
    """
    Service coordinating data synchronization from external APIs and CSV uploads
    into authoritative database tables with full audit logging.
    """

    def __init__(self):
        self.client = ComtradeAPIClient()
        self._is_running = False
        self._scheduler_enabled = True
        self._sync_interval_hours = 24
        self._background_task: Optional[asyncio.Task] = None

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def scheduler_enabled(self) -> bool:
        return self._scheduler_enabled

    @scheduler_enabled.setter
    def scheduler_enabled(self, val: bool) -> None:
        self._scheduler_enabled = val

    @property
    def sync_interval_hours(self) -> int:
        return self._sync_interval_hours

    @sync_interval_hours.setter
    def sync_interval_hours(self, hours: int) -> None:
        self._sync_interval_hours = max(1, int(hours))

    def get_status(self, db: Session) -> Dict[str, Any]:
        """Returns the current state, active scheduler settings, and recent audit logs."""
        recent_logs = (
            db.query(DataSyncLog)
            .order_by(DataSyncLog.id.desc())
            .limit(10)
            .all()
        )
        last_log = recent_logs[0].to_dict() if recent_logs else None

        return {
            "is_running": self._is_running,
            "status": "RUNNING" if self._is_running else "IDLE",
            "last_sync": last_log,
            "scheduler_enabled": self._scheduler_enabled,
            "sync_interval_hours": self._sync_interval_hours,
            "recent_logs": [log.to_dict() for log in recent_logs],
        }

    def _get_or_create_country(self, db: Session, iso: str, name: str) -> Country:
        """Finds or creates a country record in the reference table."""
        iso_clean = str(iso).strip().upper()
        country = db.query(Country).filter(Country.iso_code == iso_clean).first()
        if not country:
            country = Country(iso_code=iso_clean, country_name=name)
            db.add(country)
            db.flush()
        return country

    def _get_or_create_product(self, db: Session, code: str, name: str) -> Product:
        """Finds or creates a product classification in the reference table."""
        code_clean = str(code).strip()
        product = db.query(Product).filter(Product.product_code == code_clean).first()
        if not product:
            level = "TOTAL" if code_clean == "TOTAL" else "HS2"
            product = Product(product_code=code_clean, product_name=name, product_level=level)
            db.add(product)
            db.flush()
        return product

    def ingest_records(
        self,
        db: Session,
        records: List[Dict[str, Any]],
        sync_type: str = "API_PULL",
        source_name: str = "UN_COMTRADE_API_V1",
    ) -> DataSyncLog:
        """
        Persists a batch of normalized trade records into trade_records_v2
        with duplicate prevention and audit logging.
        """
        sync_log = DataSyncLog(
            sync_type=sync_type,
            status="RUNNING",
            started_at=datetime.now(timezone.utc),
            source_name=source_name,
            records_processed=len(records),
        )
        db.add(sync_log)
        db.commit()
        db.refresh(sync_log)

        inserted_count = 0
        skipped_count = 0
        rejected_count = 0

        try:
            for rec in records:
                try:
                    year = int(rec["refYear"])
                    rep_iso = str(rec["reporterISO"]).strip().upper()
                    rep_desc = str(rec.get("reporterDesc") or rep_iso)
                    part_iso = str(rec.get("partnerISO") or "W00").strip().upper()
                    part_desc = str(rec.get("partnerDesc") or ("World" if part_iso == "W00" else part_iso))
                    flow_code = str(rec["flowCode"]).strip().upper()
                    flow_name = str(rec.get("flowDesc") or ("Import" if flow_code == "M" else "Export"))
                    cmd_code = str(rec.get("cmdCode") or "TOTAL").strip()
                    cmd_desc = str(rec.get("cmdDesc") or "All Commodities")
                    primary_val = float(rec["primaryValue"])

                    # Resolve / Create foreign keys
                    rep = self._get_or_create_country(db, rep_iso, rep_desc)
                    part = self._get_or_create_country(db, part_iso, part_desc)
                    prod = self._get_or_create_product(db, cmd_code, cmd_desc)

                    # Deduplication check: (year, reporter_id, partner_id, product_id, flow_code)
                    existing_v2 = (
                        db.query(TradeRecordV2)
                        .filter(
                            TradeRecordV2.year == year,
                            TradeRecordV2.reporter_id == rep.country_id,
                            TradeRecordV2.partner_id == part.country_id,
                            TradeRecordV2.product_id == prod.product_id,
                            TradeRecordV2.flow_code == flow_code,
                        )
                        .first()
                    )

                    if existing_v2:
                        skipped_count += 1
                        continue

                    # Insert new record into trade_records_v2
                    new_tr_v2 = TradeRecordV2(
                        year=year,
                        reporter_id=rep.country_id,
                        partner_id=part.country_id,
                        product_id=prod.product_id,
                        flow_code=flow_code,
                        flow_name=flow_name,
                        primary_value=primary_val,
                        fob_value=rec.get("fobvalue"),
                        cif_value=rec.get("cifvalue"),
                        quantity=rec.get("qty"),
                        source=source_name,
                        is_reported=True,
                        is_aggregate=(cmd_code == "TOTAL" and part_iso == "W00"),
                    )
                    db.add(new_tr_v2)

                    # Also populate legacy baseline table trade_records if it is macro World/TOTAL
                    if part_iso == "W00" and cmd_code == "TOTAL":
                        existing_tr = (
                            db.query(TradeRecord)
                            .filter(
                                TradeRecord.refYear == year,
                                TradeRecord.reporterISO == rep_iso,
                                TradeRecord.partnerISO == part_iso,
                                TradeRecord.flowCode == flow_code,
                                TradeRecord.cmdCode == cmd_code,
                            )
                            .first()
                        )
                        if not existing_tr:
                            new_tr = TradeRecord(
                                refYear=year,
                                reporterISO=rep_iso,
                                reporterDesc=rep_desc,
                                flowCode=flow_code,
                                flowDesc=flow_name,
                                partnerISO=part_iso,
                                partnerDesc=part_desc,
                                cmdCode=cmd_code,
                                cmdDesc=cmd_desc,
                                primaryValue=primary_val,
                                fobvalue=rec.get("fobvalue"),
                                cifvalue=rec.get("cifvalue"),
                                qty=rec.get("qty"),
                                netWgt=rec.get("netWgt"),
                                grossWgt=rec.get("grossWgt"),
                            )
                            db.add(new_tr)

                    inserted_count += 1

                except Exception as row_err:
                    logger.warning(f"Failed to ingest record: {rec}. Error: {row_err}")
                    rejected_count += 1

            db.commit()

            sync_log.status = "SUCCESS"
            sync_log.completed_at = datetime.now(timezone.utc)
            sync_log.records_inserted = inserted_count
            sync_log.records_skipped = skipped_count
            sync_log.records_rejected = rejected_count
            sync_log.details = json.dumps({
                "source": source_name,
                "inserted": inserted_count,
                "skipped": skipped_count,
                "rejected": rejected_count,
            })
            db.commit()
            db.refresh(sync_log)

            logger.info(
                f"Sync Completed ({sync_type}): Inserted={inserted_count}, "
                f"Skipped={skipped_count}, Rejected={rejected_count}"
            )
            return sync_log

        except Exception as e:
            db.rollback()
            err_msg = str(e)[:900]
            sync_log.status = "FAILED"
            sync_log.completed_at = datetime.now(timezone.utc)
            sync_log.error_message = err_msg
            db.commit()
            logger.error(f"Sync execution failed: {e}\n{traceback.format_exc()}")
            return sync_log

    async def execute_api_sync(
        self,
        reporters: Optional[List[str]] = None,
        years: Optional[List[int]] = None,
        flows: Optional[List[str]] = None,
        commodities: Optional[List[str]] = None,
        sync_type: str = "API_PULL",
    ) -> Dict[str, Any]:
        """
        Coordinates asynchronous fetch from UN Comtrade and writes to database.
        """
        if self._is_running:
            return {"success": False, "message": "A data synchronization task is already in progress."}

        self._is_running = True
        reporters = reporters or ["IND", "USA", "CHN", "DEU"]
        years = years or [2024, 2025]
        flows = flows or ["M", "X"]
        commodities = commodities or ["TOTAL"]

        logger.info(f"Starting API Sync for reporters={reporters}, years={years}, flows={flows}...")

        try:
            records = await self.client.fetch_trade_data(
                reporter_codes=reporters,
                partner_codes=["0"],
                years=years,
                flows=flows,
                cmd_codes=commodities,
            )

            db = SessionLocal()
            try:
                log_entry = self.ingest_records(
                    db=db,
                    records=records,
                    sync_type=sync_type,
                    source_name="UN_COMTRADE_API_V1",
                )
                return {
                    "success": log_entry.status == "SUCCESS",
                    "log_id": log_entry.id,
                    "records_fetched": len(records),
                    "records_inserted": log_entry.records_inserted,
                    "records_skipped": log_entry.records_skipped,
                    "records_rejected": log_entry.records_rejected,
                    "status": log_entry.status,
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"API Sync error: {e}")
            db = SessionLocal()
            try:
                failed_log = DataSyncLog(
                    sync_type=sync_type,
                    status="FAILED",
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc),
                    source_name="UN_COMTRADE_API_V1",
                    error_message=str(e)[:900],
                )
                db.add(failed_log)
                db.commit()
            finally:
                db.close()

            return {"success": False, "message": str(e)}

        finally:
            self._is_running = False

    async def _scheduler_loop(self) -> None:
        """Background asynchronous timer task running periodically."""
        logger.info(f"Background Sync Cron Scheduler started (interval={self._sync_interval_hours}h).")
        while True:
            try:
                # Sleep in 60-second chunks so configuration changes take effect promptly
                sleep_seconds = self._sync_interval_hours * 3600
                logger.info(f"Scheduler waiting {self._sync_interval_hours} hours until next sync cycle...")
                
                # Check condition periodically
                for _ in range(int(sleep_seconds // 60)):
                    await asyncio.sleep(60)
                    if not self._scheduler_enabled:
                        break

                if self._scheduler_enabled and not self._is_running:
                    logger.info("Cron schedule triggered: executing automated UN Comtrade sync...")
                    await self.execute_api_sync(sync_type="SCHEDULED_CRON")

            except asyncio.CancelledError:
                logger.info("Background Sync Cron Scheduler cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(300)

    def start_scheduler(self) -> None:
        """Launches the background async scheduler task."""
        if self._background_task is None or self._background_task.done():
            loop = asyncio.get_event_loop()
            self._background_task = loop.create_task(self._scheduler_loop())
            logger.info("DataSyncService background scheduler task created.")

    def stop_scheduler(self) -> None:
        """Cancels the background async scheduler task."""
        if self._background_task and not self._background_task.done():
            self._background_task.cancel()
            self._background_task = None
            logger.info("DataSyncService background scheduler task stopped.")


# Singleton service instance
sync_service = DataSyncService()
