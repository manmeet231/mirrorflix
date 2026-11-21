from typing import Any
import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import case, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    # Project-root launch: uvicorn backend.main:app
    from backend.database import get_db
    from backend.models import Category, FeaturedMovie, Genre, Movie
except ModuleNotFoundError as exc:
    if exc.name != "backend":
        raise
    # Existing service launch: from backend/, uvicorn main:app
    from database import get_db
    from models import Category, FeaturedMovie, Genre, Movie


app = FastAPI(title="MirrorFlix API", version="1.0.0")


def _configured_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "https://alterbucket.in,https://www.alterbucket.in,"
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Admin-Token"],
)


def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    configured_token = os.getenv("API_ADMIN_TOKEN")
    if not configured_token:
        raise HTTPException(status_code=503, detail="Content management API is not configured")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, configured_token):
        raise HTTPException(status_code=401, detail="Invalid or missing admin token")


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_request, _exc: SQLAlchemyError):
    # Keep database details and connection strings out of public responses.
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is temporarily unavailable"},
    )


def _serialize_movie(movie: Movie, category_name: str | None = None) -> dict[str, Any]:
    return {
        "id": movie.id,
        "title": movie.title,
        "description": movie.description,
        "synopsis": movie.description,
        "year": movie.release_year,
        "releaseYear": movie.release_year,
        "poster": movie.poster_url,
        "posterUrl": movie.poster_url,
        "backdrop": movie.backdrop_url,
        "backdropUrl": movie.backdrop_url,
        "backgroundImage": movie.backdrop_url or movie.poster_url,
        "averageRating": float(movie.average_rating or 0),
        "totalViews": movie.total_views or 0,
        "categoryId": movie.category_id,
        "category": category_name,
        "genres": [category_name] if category_name else [],
        "contentType": "movie",
    }


def _descending_nulls_last(column):
    # CASE-based ordering works in both MySQL and PostgreSQL.
    return case((column.is_(None), 1), else_=0), column.desc()


def _flatten_anime(genres: list[Genre]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for genre in genres:
        for index, raw_anime in enumerate(genre.animes or []):
            if not isinstance(raw_anime, dict):
                continue
            anime = dict(raw_anime)
            anime_id = anime.get("id")
            title = anime.get("title")
            if anime_id is not None:
                key = f"id:{type(anime_id).__name__}:{anime_id}"
            elif title:
                key = f"title:{title if isinstance(title, str) else repr(title)}"
            else:
                key = f"genre:{genre.id}:index:{index}"

            item = unique.setdefault(key, anime)
            existing_genres = item.get("genres")
            if isinstance(existing_genres, str):
                existing_genres = [existing_genres]
            elif not isinstance(existing_genres, list):
                existing_genres = []
            if genre.name not in existing_genres:
                existing_genres.append(genre.name)
            item["genres"] = existing_genres
    return list(unique.values())


@app.get("/")
def home():
    return {"message": "MirrorFlix API is running"}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@app.get("/api/movies/featured")
def get_featured_movies(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Movie, Category.name)
        .join(FeaturedMovie, Movie.id == FeaturedMovie.movie_id)
        .outerjoin(Category, Movie.category_id == Category.id)
        .filter(FeaturedMovie.is_active.is_(True))
        .order_by(*_descending_nulls_last(FeaturedMovie.featured_score), FeaturedMovie.id.asc())
        .limit(limit)
        .all()
    )
    return [_serialize_movie(movie, category_name) for movie, category_name in rows]


@app.get("/api/movies")
def get_movies(
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: str | None = Query(default=None, min_length=1, max_length=100),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    sort: str = Query(default="recent", pattern="^(recent|popular|rating|title)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Movie, Category.name).outerjoin(Category, Movie.category_id == Category.id)
    if category:
        if category.isdecimal():
            query = query.filter(Movie.category_id == int(category))
        else:
            query = query.filter(Category.name.ilike(category))
    if search:
        query = query.filter(Movie.title.ilike(f"%{search.strip()}%"))

    ordering = {
        "recent": (*_descending_nulls_last(Movie.created_at), Movie.id.desc()),
        "popular": (*_descending_nulls_last(Movie.total_views), Movie.id.desc()),
        "rating": (*_descending_nulls_last(Movie.average_rating), Movie.id.desc()),
        "title": (Movie.title.asc(), Movie.id.asc()),
    }[sort]
    total = query.count()
    rows = query.order_by(*ordering).offset(offset).limit(limit).all()
    return {
        "items": [_serialize_movie(movie, category_name) for movie, category_name in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": offset + len(rows) < total,
    }


@app.get("/api/movies/{movie_id}")
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(Movie, Category.name)
        .outerjoin(Category, Movie.category_id == Category.id)
        .filter(Movie.id == movie_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    movie, category_name = row
    return _serialize_movie(movie, category_name)


@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.name.asc()).all()
    return [{"id": category.id, "name": category.name} for category in categories]


@app.get("/api/anime")
def get_anime(
    genre: str | None = Query(default=None, min_length=1, max_length=100),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Genre).order_by(Genre.id.asc())
    if genre:
        query = query.filter(Genre.name.ilike(genre))
        selected_genres = query.all()
        if not selected_genres:
            raise HTTPException(status_code=404, detail="Genre not found")
    else:
        selected_genres = query.all()

    anime = _flatten_anime(selected_genres)
    return {
        "items": anime[offset : offset + limit],
        "total": len(anime),
        "limit": limit,
        "offset": offset,
        "hasMore": offset + limit < len(anime),
    }


@app.get("/api/anime/{anime_id}")
def get_anime_by_id(anime_id: str, db: Session = Depends(get_db)):
    for anime in _flatten_anime(db.query(Genre).order_by(Genre.id.asc()).all()):
        if str(anime.get("id")) == anime_id:
            return anime
    raise HTTPException(status_code=404, detail="Anime not found")


@app.get("/api/genres")
def get_genres(db: Session = Depends(get_db)):
    genres = db.query(Genre).order_by(Genre.id.asc()).all()
    return [{"id": genre.id, "name": genre.name, "animes": genre.animes or []} for genre in genres]


@app.get("/api/genres/{genre_name}")
def get_genre(genre_name: str, db: Session = Depends(get_db)):
    genre = db.query(Genre).filter(Genre.name.ilike(genre_name)).first()
    if not genre:
        raise HTTPException(status_code=404, detail="Genre not found")
    return {"id": genre.id, "name": genre.name, "animes": genre.animes or []}


@app.post("/api/genres/{genre_name}/animes", dependencies=[Depends(require_admin_token)])
def add_anime_to_genre(genre_name: str, anime: dict[str, Any], db: Session = Depends(get_db)):
    genre = db.query(Genre).filter(Genre.name.ilike(genre_name)).first()
    if not genre:
        raise HTTPException(status_code=404, detail="Genre not found")
    items = list(genre.animes or [])
    anime_id = anime.get("id")
    if anime_id is not None:
        items = [item for item in items if not isinstance(item, dict) or item.get("id") != anime_id]
    items.append(anime)
    genre.animes = items
    db.commit()
    db.refresh(genre)
    return {"genre": genre.name, "total_animes": len(genre.animes)}
