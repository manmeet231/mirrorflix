"""Explicit additive initialization; inspect/backup a database before running."""
from pathlib import Path
from dotenv import load_dotenv
from .database import make_engine
from .models import Base


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    engine = make_engine()
    Base.metadata.create_all(engine)
    engine.dispose()
    print("Missing catalog_* tables created. Existing tables/data were not migrated or dropped.")


if __name__ == "__main__":
    main()
