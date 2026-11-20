"""Loopback catalog server; writes fail closed without an administrator token."""
import hmac
import os
from contextlib import asynccontextmanager
from typing import Annotated
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from .database import make_engine
from .limits import BodyLimitMiddleware
from .models import Title, Genre, TitleGenre
from .repository import upsert_title, serialize, legacy_item
from .schemas import BatchIn, TitleIn


class LegacyBatch(BaseModel):
    animes: list[dict] = Field(min_length=1, max_length=100)


def create_app(engine=None, write_token=None):
    engine = engine if engine is not None else make_engine()
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    token = write_token if write_token is not None else os.getenv("CATALOG_WRITE_TOKEN", "")

    @asynccontextmanager
    async def lifespan(app):
        yield
        engine.dispose()

    app = FastAPI(title="Alterbucket Catalog API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware)

    def session():
        with factory() as db:
            yield db

    def authorized(authorization: Annotated[str | None, Header()] = None):
        if len(token) < 32:
            raise HTTPException(503, "Catalog writes disabled: configure a token of at least 32 characters")
        if authorization is None or not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
            raise HTTPException(401, "Valid catalog bearer token required", headers={"WWW-Authenticate": "Bearer"})

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, error):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"detail": "Catalog database unavailable; inspect private server logs"})

    @app.get("/api/health")
    def health(db: Session = Depends(session)):
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "reachable"}

    @app.get("/api/titles")
    def titles(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
               media_type: str | None = Query(None, pattern="^(movie|series|anime)$"),
               genre: str | None = Query(None, max_length=100), db: Session = Depends(session)):
        query = select(Title)
        if media_type:
            query = query.where(Title.media_type == media_type)
        if genre:
            query = query.where(Title.genre_links.any(TitleGenre.genre.has(Genre.name == genre)))
        rows = db.scalars(query.order_by(Title.id).offset(offset).limit(limit + 1)).all()
        return {"items": [serialize(row) for row in rows[:limit]], "offset": offset,
                "limit": limit, "next_offset": offset + limit if len(rows) > limit else None}

    @app.get("/api/titles/{title_id}")
    def title_detail(title_id: int, db: Session = Depends(session)):
        row = db.get(Title, title_id)
        if row is None:
            raise HTTPException(404, "Title not found")
        return serialize(row)

    @app.post("/api/titles/batch", dependencies=[Depends(authorized)])
    def write_titles(body: BatchIn, db: Session = Depends(session)):
        identifiers = [(i.source, i.media_type, i.source_id) for i in body.titles]
        if len(set(identifiers)) != len(identifiers):
            raise HTTPException(422, "Duplicate source identity in batch")
        ids, created = [], 0
        try:
            with db.begin():
                for item in body.titles:
                    row, is_new = upsert_title(db, item)
                    ids.append(row.id)
                    created += is_new
        except IntegrityError:
            raise HTTPException(409, "Concurrent catalog write; retry this idempotent batch")
        return {"created": created, "updated": len(ids) - created, "ids": ids}

    @app.get("/api/genres")
    def genres(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
               per_genre: int = Query(100, ge=1, le=100), db: Session = Depends(session)):
        rows = db.scalars(select(Genre).order_by(Genre.id).offset(offset).limit(limit)).all()
        return [genre_result(db, row, per_genre, 0) for row in rows]

    @app.get("/api/genres/{name}")
    def genre_detail(name: str, limit: int = Query(100, ge=1, le=100),
                     offset: int = Query(0, ge=0), db: Session = Depends(session)):
        row = db.scalar(select(Genre).where(Genre.name == name))
        if row is None:
            raise HTTPException(404, "Genre not found")
        return genre_result(db, row, limit, offset)

    def genre_result(db, row, limit, offset):
        titles = db.scalars(select(Title).join(TitleGenre).where(TitleGenre.genre_id == row.id).order_by(Title.id).offset(offset).limit(limit + 1)).all()
        return {"id": row.id, "name": row.name, "animes": [legacy_item(t) for t in titles[:limit]],
                "next_offset": offset + limit if len(titles) > limit else None}

    @app.post("/api/genres/{name}/animes", dependencies=[Depends(authorized)])
    def write_legacy(name: str, body: LegacyBatch, db: Session = Depends(session)):
        converted = []
        try:
            for item in body.animes:
                # Legacy AniList objects use format (TV/MOVIE) as 'rating', not a score.
                score = item.get("matchPercentage")
                score = float(str(score).rstrip("%")) / 10 if score is not None else None
                item_genres = item.get("genres") or []
                converted.append(TitleIn(source="anilist", source_id=str(item.get("id") or ""), media_type="anime",
                    title=item.get("title", ""), synopsis=item.get("description") or item.get("synopsis"),
                    release_year=item.get("year"), rating=score, age_rating=item.get("ageRating"),
                    poster_url=item.get("poster"), backdrop_url=item.get("backdrop"),
                    genres=list(dict.fromkeys([name, *item_genres]))))
        except (ValueError, TypeError, ValidationError):
            raise HTTPException(422, "Invalid legacy anime payload; id, title and valid metadata required")
        try:
            with db.begin():
                for data, original in zip(converted, body.animes):
                    upsert_title(db, data, legacy=original)
        except IntegrityError:
            raise HTTPException(409, "Concurrent catalog write; retry the batch")
        return {"success": True, "processed": len(converted)}

    return app
