"""Additive catalog tables; never create/alter tables at API startup."""
from datetime import date, datetime, timezone
from sqlalchemy import (JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer,
                        String, Text, UniqueConstraint, Index)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.mysql import MEDIUMTEXT

SYNOPSIS_TEXT = Text().with_variant(MEDIUMTEXT(), "mysql")


class Base(DeclarativeBase):
    pass


class Title(Base):
    __tablename__ = "catalog_titles"
    __table_args__ = (
        UniqueConstraint("source", "media_type", "source_id", name="uq_catalog_source"),
        Index("ix_catalog_title", "title"),
        {"mysql_charset": "utf8mb4"},
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[str] = mapped_column(String(100))
    media_type: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(255))
    synopsis: Mapped[str | None] = mapped_column(SYNOPSIS_TEXT)
    release_year: Mapped[int | None]
    rating: Mapped[float | None] = mapped_column(Float)
    rating_count: Mapped[int | None]
    age_rating: Mapped[str | None] = mapped_column(String(50))
    age_rating_region: Mapped[str | None] = mapped_column(String(2))
    season_count: Mapped[int | None]
    episode_count: Mapped[int | None]
    runtime_minutes: Mapped[int | None]
    status: Mapped[str | None] = mapped_column(String(80))
    poster_url: Mapped[str | None] = mapped_column(Text)
    backdrop_url: Mapped[str | None] = mapped_column(Text)
    cast: Mapped[list] = mapped_column(JSON, default=list)
    legacy: Mapped[dict | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    genre_links: Mapped[list["TitleGenre"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    seasons: Mapped[list["Season"]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="Season.number")


class Genre(Base):
    __tablename__ = "catalog_genres"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class TitleGenre(Base):
    __tablename__ = "catalog_title_genres"
    title_id: Mapped[int] = mapped_column(ForeignKey("catalog_titles.id"), primary_key=True)
    genre_id: Mapped[int] = mapped_column(ForeignKey("catalog_genres.id"), primary_key=True)
    genre: Mapped[Genre] = relationship(lazy="joined")


class Season(Base):
    __tablename__ = "catalog_seasons"
    __table_args__ = (UniqueConstraint("title_id", "number", name="uq_catalog_season"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    title_id: Mapped[int] = mapped_column(ForeignKey("catalog_titles.id"))
    number: Mapped[int]
    name: Mapped[str | None] = mapped_column(String(255))
    synopsis: Mapped[str | None] = mapped_column(SYNOPSIS_TEXT)
    episodes: Mapped[list["Episode"]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="Episode.number")


class Episode(Base):
    __tablename__ = "catalog_episodes"
    __table_args__ = (UniqueConstraint("season_id", "number", name="uq_catalog_episode"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("catalog_seasons.id"))
    number: Mapped[int]
    name: Mapped[str | None] = mapped_column(String(255))
    synopsis: Mapped[str | None] = mapped_column(SYNOPSIS_TEXT)
    runtime_minutes: Mapped[int | None]
    air_date: Mapped[date | None] = mapped_column(Date)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
