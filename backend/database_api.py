import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import declarative_base, sessionmaker, Session

load_dotenv("/root/mirrorflix-source/backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

# Maps the existing table. This service does not create or migrate tables.
class Genre(Base):
    __tablename__ = "genres"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    animes = Column(MutableList.as_mutable(JSONB), nullable=False)

class AnimePayload(BaseModel):
    animes: list[dict[str, Any]]

app = FastAPI(title="MirrorFlix Database API")

# Allow the Vite dev server origins to call this API cross-origin (local dev).
# Production is same-origin (nginx), so the default list only needs dev origins.
# Override with CORS_ORIGINS in backend/.env (comma-separated, or * for any origin).
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/genres")
def get_genres(db: Session = Depends(get_db)):
    genres = db.query(Genre).order_by(Genre.id).all()
    return [
        {"id": g.id, "name": g.name, "animes": g.animes or []}
        for g in genres
    ]

@app.get("/api/genres/{genre_name}")
def get_genre(genre_name: str, db: Session = Depends(get_db)):
    genre = db.query(Genre).filter(Genre.name.ilike(genre_name)).first()
    if genre is None:
        raise HTTPException(status_code=404, detail="Genre not found")
    return {"id": genre.id, "name": genre.name, "animes": genre.animes or []}

@app.post("/api/genres/{genre_name}/animes")
def add_animes(
    genre_name: str,
    payload: AnimePayload,
    db: Session = Depends(get_db),
):
    genre = db.query(Genre).filter(Genre.name.ilike(genre_name)).first()
    if genre is None:
        raise HTTPException(status_code=404, detail="Genre not found")

    existing = list(genre.animes or [])
    existing_ids = {
        str(item["id"])
        for item in existing
        if isinstance(item, dict) and item.get("id") is not None
    }

    added = 0
    for anime in payload.animes:
        anime_id = anime.get("id")
        if anime_id is not None:
            if str(anime_id) in existing_ids:
                continue
            existing_ids.add(str(anime_id))
        elif anime in existing:
            continue

        existing.append(anime)
        added += 1

    if added:
        genre.animes = existing
        db.commit()

    return {
        "success": True,
        "message": f"Added {added} anime to {genre.name}",
        "added": added,
        "total": len(existing),
    }
