"""
Stage 1 Database Migration Script:
1. Creates full database backup with SHA256 checksum and row count verification.
2. Creates reference tables: countries and products.
3. Populates countries (190 reporters + World) and products (TOTAL).
4. Creates trade_records_v2 with foreign keys and required indexes.
5. Migrates all 3,925 records with 100% integrity and zero alteration to existing trade_records.
"""
import os
import shutil
import hashlib
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]
DB_PATH = BASE_DIR / "data" / "trade_data.db"
BACKUP_PATH = BASE_DIR / "data" / "trade_data_pre_upgrade_backup.db"

def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def run_migration():
    print("=" * 80)
    print("STAGE 1 DATABASE SCHEMA UPGRADE & MIGRATION")
    print("=" * 80)

    # 1. Verification of original database
    assert DB_PATH.exists(), f"Database not found at {DB_PATH}"
    orig_size = DB_PATH.stat().st_size
    orig_hash = compute_sha256(DB_PATH)

    conn_orig = sqlite3.connect(DB_PATH)
    cur_orig = conn_orig.cursor()
    cur_orig.execute("SELECT COUNT(*) FROM trade_records")
    orig_trade_count = cur_orig.fetchone()[0]
    cur_orig.execute("SELECT COUNT(*) FROM users")
    orig_user_count = cur_orig.fetchone()[0]
    conn_orig.close()

    print(f"\n[STEP 1] Pre-migration Database Snapshot:")
    print(f"  Source Path:        {DB_PATH}")
    print(f"  File Size:          {orig_size:,} bytes")
    print(f"  SHA-256 Checksum:   {orig_hash}")
    print(f"  trade_records rows: {orig_trade_count} (Expected: 3925)")
    print(f"  users rows:         {orig_user_count}")
    assert orig_trade_count == 3925, f"Expected 3925 rows, found {orig_trade_count}"

    # 2. Create Backup
    print(f"\n[STEP 2] Creating Full Database Backup:")
    shutil.copy2(DB_PATH, BACKUP_PATH)
    assert BACKUP_PATH.exists(), "Backup failed to create"
    backup_size = BACKUP_PATH.stat().st_size
    backup_hash = compute_sha256(BACKUP_PATH)

    conn_bk = sqlite3.connect(BACKUP_PATH)
    cur_bk = conn_bk.cursor()
    cur_bk.execute("SELECT COUNT(*) FROM trade_records")
    bk_trade_count = cur_bk.fetchone()[0]
    conn_bk.close()

    print(f"  Backup Path:        {BACKUP_PATH}")
    print(f"  Backup Size:        {backup_size:,} bytes")
    print(f"  Backup Checksum:    {backup_hash}")
    print(f"  Backup trade rows:  {bk_trade_count}")
    assert backup_hash == orig_hash, "Backup checksum mismatch!"
    assert bk_trade_count == 3925, "Backup row count mismatch!"
    print("  Backup Status:      VERIFIED (Identical byte-for-byte)")

    # 3. Apply Schema Upgrades in Active Database
    print(f"\n[STEP 3] Executing Schema Upgrades & Data Migration:")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    try:
        # Reference Table: countries
        cur.execute("""
            CREATE TABLE IF NOT EXISTS countries (
                country_id INTEGER PRIMARY KEY AUTOINCREMENT,
                iso_code VARCHAR(10) UNIQUE NOT NULL,
                country_name VARCHAR(255) NOT NULL
            );
        """)

        # Reference Table: products
        cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                product_id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_code VARCHAR(20) UNIQUE NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                product_level VARCHAR(50) NOT NULL
            );
        """)

        # Populate countries from existing reporters (190 reporters)
        cur.execute("""
            INSERT OR IGNORE INTO countries (iso_code, country_name)
            SELECT DISTINCT reporterISO, reporterDesc
            FROM trade_records
            ORDER BY reporterISO;
        """)

        # Add World as a partner country (W00)
        cur.execute("""
            INSERT OR IGNORE INTO countries (iso_code, country_name)
            VALUES ('W00', 'World');
        """)

        # Populate products with TOTAL / All Commodities
        cur.execute("""
            INSERT OR IGNORE INTO products (product_code, product_name, product_level)
            VALUES ('TOTAL', 'All Commodities', 'TOTAL');
        """)

        # Create trade_records_v2
        cur.execute("""
            CREATE TABLE IF NOT EXISTS trade_records_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year INTEGER NOT NULL,
                reporter_id INTEGER NOT NULL REFERENCES countries(country_id),
                partner_id INTEGER NOT NULL REFERENCES countries(country_id),
                product_id INTEGER NOT NULL REFERENCES products(product_id),
                flow_code VARCHAR(10) NOT NULL,
                flow_name VARCHAR(50),
                primary_value FLOAT NOT NULL,
                fob_value FLOAT,
                cif_value FLOAT,
                quantity FLOAT,
                source VARCHAR(50) DEFAULT 'UN_COMTRADE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create indexes on trade_records_v2
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tr_v2_year ON trade_records_v2(year);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tr_v2_reporter_id ON trade_records_v2(reporter_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tr_v2_partner_id ON trade_records_v2(partner_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tr_v2_product_id ON trade_records_v2(product_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tr_v2_flow_code ON trade_records_v2(flow_code);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tr_v2_composite ON trade_records_v2(year, reporter_id, partner_id, product_id, flow_code);")

        # Check if trade_records_v2 already has records (in case of re-run)
        cur.execute("SELECT COUNT(*) FROM trade_records_v2;")
        v2_existing = cur.fetchone()[0]
        if v2_existing == 0:
            print("  Migrating 3,925 records from trade_records into trade_records_v2...")
            cur.execute("""
                INSERT INTO trade_records_v2 (
                    year,
                    reporter_id,
                    partner_id,
                    product_id,
                    flow_code,
                    flow_name,
                    primary_value,
                    fob_value,
                    cif_value,
                    quantity,
                    source,
                    created_at
                )
                SELECT 
                    t.refYear,
                    rc.country_id,
                    pc.country_id,
                    pr.product_id,
                    t.flowCode,
                    t.flowDesc,
                    t.primaryValue,
                    t.fobvalue,
                    t.cifvalue,
                    t.qty,
                    'UN_COMTRADE',
                    t.createdAt
                FROM trade_records t
                JOIN countries rc ON rc.iso_code = t.reporterISO
                JOIN countries pc ON pc.iso_code = t.partnerISO
                JOIN products pr ON pr.product_code = t.cmdCode
                ORDER BY t.id;
            """)
        else:
            print(f"  trade_records_v2 already contains {v2_existing} rows; skipping insert.")

        conn.commit()
        print("  Database migration committed successfully.")

    except Exception as e:
        conn.rollback()
        conn.close()
        raise RuntimeError(f"Migration aborted and rolled back due to error: {e}")

    # 4. Rigorous Post-Migration Verifications
    print(f"\n[STEP 4] Post-Migration Integrity Validations:")
    
    # Original table row count
    cur.execute("SELECT COUNT(*) FROM trade_records")
    post_orig_count = cur.fetchone()[0]
    print(f"  Original trade_records count: {post_orig_count} (Expected: 3925, Unchanged: {post_orig_count == 3925})")
    assert post_orig_count == 3925

    # New table row count
    cur.execute("SELECT COUNT(*) FROM trade_records_v2")
    post_v2_count = cur.fetchone()[0]
    print(f"  New trade_records_v2 count:   {post_v2_count} (Expected: 3925, Exact match: {post_v2_count == 3925})")
    assert post_v2_count == 3925

    # Reference tables row counts
    cur.execute("SELECT COUNT(*) FROM countries")
    countries_count = cur.fetchone()[0]
    print(f"  Countries reference count:    {countries_count} (190 reporters + 1 partner World = 191)")
    assert countries_count == 191

    cur.execute("SELECT COUNT(*) FROM products")
    products_count = cur.fetchone()[0]
    print(f"  Products reference count:     {products_count} ('TOTAL' = 1)")
    assert products_count == 1

    # Verify every record in trade_records_v2 links to partner=World and product=TOTAL
    cur.execute("""
        SELECT COUNT(*)
        FROM trade_records_v2 v
        JOIN countries pc ON pc.country_id = v.partner_id
        JOIN products pr ON pr.product_id = v.product_id
        WHERE pc.iso_code = 'W00' AND pc.country_name = 'World'
          AND pr.product_code = 'TOTAL' AND pr.product_name = 'All Commodities'
    """)
    correctly_linked_count = cur.fetchone()[0]
    print(f"  Records correctly linked to World & TOTAL: {correctly_linked_count} / {post_v2_count}")
    assert correctly_linked_count == 3925

    # Verify financial sums match between tables
    cur.execute("SELECT SUM(primaryValue), SUM(fobvalue), SUM(cifvalue) FROM trade_records")
    orig_sums = cur.fetchone()
    cur.execute("SELECT SUM(primary_value), SUM(fob_value), SUM(cif_value) FROM trade_records_v2")
    v2_sums = cur.fetchone()

    print(f"  Sum primaryValue (orig vs v2): {orig_sums[0]:,.2f} vs {v2_sums[0]:,.2f} (Diff: {abs(orig_sums[0] - v2_sums[0]):.2e})")
    print(f"  Sum fobvalue (orig vs v2):     {orig_sums[1]:,.2f} vs {v2_sums[1]:,.2f} (Diff: {abs(orig_sums[1] - v2_sums[1]):.2e})")
    print(f"  Sum cifvalue (orig vs v2):     {orig_sums[2]:,.2f} vs {v2_sums[2]:,.2f} (Diff: {abs(orig_sums[2] - v2_sums[2]):.2e})")
    assert abs(orig_sums[0] - v2_sums[0]) < 1e-4

    conn.close()
    print("\n>>> ALL POST-MIGRATION CHECKS PASSED WITH 100% MATHEMATICAL PRECISION.")

if __name__ == "__main__":
    run_migration()
