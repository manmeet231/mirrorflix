
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    BigInteger,
    DateTime,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint
)
from sqlalchemy.sql import func
try:
    # Project-root launch: uvicorn backend.main:app
    from backend.database import Base
except ModuleNotFoundError as exc:
    if exc.name != "backend":
        raise
    # Existing service launch: from backend/, uvicorn main:app
    from database import Base


# 1. Categories table
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)


# 2. Movies table
class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    release_year = Column(Integer)
    poster_url = Column(Text)
    backdrop_url = Column(Text)
    streamtape_file_id = Column(String(255))
    category_id = Column(
        Integer,
        ForeignKey("categories.id")
    )
    average_rating = Column(Numeric(3, 1), default=0)
    total_views = Column(BigInteger, default=0)
    created_at = Column(DateTime, server_default=func.now())


# 3. Featured movies table
class FeaturedMovie(Base):
    __tablename__ = "featured_movies"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(
        Integer,
        ForeignKey("movies.id", ondelete="CASCADE"),
        unique=True
    )
    featured_score = Column(Numeric(10, 2), default=0)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, server_default=func.now())


# 4. Ratings table
class Rating(Base):
    __tablename__ = "ratings"

    __table_args__ = (
        UniqueConstraint(
            "movie_id",
            "user_id",
            name="ratings_movie_id_user_id_key"
        ),
        CheckConstraint(
            "rating >= 0 AND rating <= 10",
            name="ratings_rating_check"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(
        Integer,
        ForeignKey("movies.id", ondelete="CASCADE")
    )
    user_id = Column(Integer)
    rating = Column(Numeric(2, 1))
    created_at = Column(DateTime, server_default=func.now())


# 5. Watch history table
class WatchHistory(Base):
    __tablename__ = "watch_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    movie_id = Column(
        Integer,
        ForeignKey("movies.id", ondelete="CASCADE")
    )
    watched_at = Column(DateTime, server_default=func.now())
    progress_seconds = Column(Integer, default=0)


from sqlalchemy import JSON
from sqlalchemy.ext.mutable import MutableList


# 6. Genres table
class Genre(Base):
    __tablename__ = "genres"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    animes = Column(MutableList.as_mutable(JSON), nullable=False, default=list)
