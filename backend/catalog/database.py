import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def make_engine(url=None):
    url = url or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required; configure it privately in backend/.env")
    options = {"pool_pre_ping": True, "hide_parameters": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **options)
