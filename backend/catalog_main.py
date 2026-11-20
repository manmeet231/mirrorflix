"""Run from backend/: uvicorn catalog_main:app --host 127.0.0.1 --port 8001."""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name(".env"))
from catalog.api import create_app
app = create_app()
