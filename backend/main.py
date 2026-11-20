"""FastAPI application for AniList integration and database sync."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.db_client import close_db_client, get_db_client
from dotenv import load_dotenv

# Ensure .env is loaded
load_dotenv()

# Import routes (ensure all service dependencies are imported here)
from api.routes import router
from logging_config import logger, setup_logging

# Load environment
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")
PORT = int(os.getenv("PORT", "8002"))


# Initialize app
app = FastAPI(
    title="MirrorFlix AniList Sync Service",
    description="Service to fetch anime from AniList and sync to genre-based database",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "MirrorFlix AniList Sync Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.on_event("startup")
async def startup_event():
    """Startup tasks - setup logging and database connection."""
    setup_logging(
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        log_file=os.getenv("log_file", "logs/sync.log")
    )
    logger.info("Startup sequence started")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks - close database connections."""
    logger.info("Shutting down service...")
    await close_db_client()


# Include API routes
app.include_router(router, prefix="/api", tags=["api"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=PORT,
        reload=False,
        log_level="warning"
    )