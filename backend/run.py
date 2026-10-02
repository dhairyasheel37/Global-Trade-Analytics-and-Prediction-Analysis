import sys
import argparse
import uvicorn
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.data_pipeline import run_pipeline
from app.config import DEFAULT_CSV_PATH

def main():
    parser = argparse.ArgumentParser(description="Trade Data Backend Manager")
    parser.add_argument("--ingest", action="store_true", help="Run data ingestion pipeline before starting server")
    parser.add_argument("--csv", type=str, default=str(DEFAULT_CSV_PATH), help="Custom CSV path for ingestion")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable live reloading for development")

    args = parser.parse_args()

    if args.ingest:
        print(f"Running data pipeline with CSV: {args.csv}")
        count, stats = run_pipeline(Path(args.csv))
        print(f"Pipeline finished. Ingested {count} records.")

    print(f"Starting FastAPI server on http://{args.host}:{args.port}...")
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)

if __name__ == "__main__":
    main()
