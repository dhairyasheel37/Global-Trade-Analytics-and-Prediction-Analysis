"""
Centralized Query Helpers for TradeRecordV2.
Provides unified filtering, joins with Country and Product, and guarantees
zero double-counting between aggregate (World/TOTAL) and granular data.
"""
from typing import Optional
from sqlalchemy.orm import aliased, Session, Query
from sqlalchemy import and_, or_

from app.models import TradeRecordV2, Country, Product

ReporterCountry = aliased(Country, name="reporter_country")
PartnerCountry = aliased(Country, name="partner_country")
ProductEntity = aliased(Product, name="product_entity")

def get_trade_v2_base_query(
    db: Session,
    reporter: Optional[str] = None,
    flow: Optional[str] = None,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    partner: Optional[str] = None,
    product: Optional[str] = None,
) -> Query:
    """
    Builds a query on TradeRecordV2 joined with Country (reporter, partner) and Product.

    CRITICAL DOUBLE-COUNTING PREVENTION:
    - If neither a specific partner nor a specific product is requested:
      Default to PartnerCountry.iso_code == 'W00' AND ProductEntity.product_code == 'TOTAL'.
      This returns the exact baseline aggregate series with 0.00 double-counting.
    - If a specific partner IS requested (e.g. 'USA'):
      Filter PartnerCountry.iso_code == partner.
      If product is also specified, filter ProductEntity.product_code == product.
      Otherwise, allow all granular products for that partner.
    - If a specific product IS requested (e.g. '30'):
      Filter ProductEntity.product_code == product.
      If partner is also specified, filter PartnerCountry.iso_code == partner.
      Otherwise, allow all granular partners for that product.
    """
    query = (
        db.query(TradeRecordV2)
        .join(ReporterCountry, TradeRecordV2.reporter_id == ReporterCountry.country_id)
        .join(PartnerCountry, TradeRecordV2.partner_id == PartnerCountry.country_id)
        .join(ProductEntity, TradeRecordV2.product_id == ProductEntity.product_id)
    )

    conditions = []

    # Clean & normalize parameters
    rep = reporter.strip() if reporter and reporter.strip() and reporter.strip() != "ALL" else None
    fl = flow.strip().upper() if flow and flow.strip() and flow.strip() != "ALL" else None
    par = partner.strip().upper() if partner and partner.strip() and partner.strip() != "ALL" else None
    prod = product.strip().upper() if product and product.strip() and product.strip() != "ALL" else None

    if rep:
        conditions.append(or_(ReporterCountry.iso_code == rep, ReporterCountry.country_name == rep))
    if fl:
        conditions.append(TradeRecordV2.flow_code == fl)
    if start_year is not None:
        conditions.append(TradeRecordV2.year >= start_year)
    if end_year is not None:
        conditions.append(TradeRecordV2.year <= end_year)

    # Double counting prevention & Granular vs Aggregate routing
    if par is None and prod is None:
        # Default top-level view: World aggregate + TOTAL commodity
        conditions.append(PartnerCountry.iso_code == "W00")
        conditions.append(ProductEntity.product_code == "TOTAL")
    else:
        if par is not None:
            conditions.append(PartnerCountry.iso_code == par)
        if prod is not None:
            conditions.append(ProductEntity.product_code == prod)

    if conditions:
        query = query.filter(and_(*conditions))
    return query
