import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Honor values supplied by the process first, then load local development files.
load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # The existing VPS service uses separate DB_* variables. Build URLs with
    # SQLAlchemy so credentials containing URL-reserved characters are escaped.
    db_host = os.getenv("DB_HOST")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_port = int(os.getenv("DB_PORT", "5432"))
    if db_host and db_name and db_user and db_password is not None:
        driver = "mysql+pymysql" if db_port == 3306 else "postgresql+psycopg"
        DATABASE_URL = URL.create(
            driver,
            username=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
            database=db_name,
        )
    else:
        raise RuntimeError(
            "Set DATABASE_URL or the DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD settings"
        )

# Create database engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

# Create database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for database models
Base = declarative_base()


# Provide database session to API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
