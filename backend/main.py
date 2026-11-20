"""FastAPI application for AniList integration and database synchronization."""
import os
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from logging_config import logger, setup_logging
from services.db_client import close_db_client

setup_logging(
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    log_file=os.getenv("LOG_FILE", os.getenv("log_file", "logs/sync.log")),
)

from api.routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("MirrorFlix sync service started")
    try:
        yield
    finally:
        logger.info("Shutting down MirrorFlix sync service")
        await close_db_client()


app = FastAPI(
    title="MirrorFlix AniList Sync Service",
    description="Fetch anime from AniList and synchronize it with the external genre database API.",
    version="1.1.0",
    lifespan=lifespan,
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["service"])
async def root():
    """Return basic service metadata."""
    return {
        "name": "MirrorFlix AniList Sync Service",
        "version": app.version,
        "status": "running",
    }


# Include API routes
app.include_router(router, prefix="/api", tags=["api"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8002")),
        reload=False,
        log_level=os.getenv("LOG_LEVEL", "INFO").lower(),
    )