from datetime import date
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Nonnegative = Annotated[int, Field(ge=0)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CastIn(StrictModel):
    name: str = Field(min_length=1, max_length=255)
    character: str | None = Field(None, max_length=255)
    source_id: str | None = Field(None, max_length=100)


class EpisodeIn(StrictModel):
    number: int = Field(ge=1)
    name: str | None = Field(None, max_length=255)
    synopsis: str | None = Field(None, max_length=100000)
    runtime_minutes: Nonnegative | None = None
    air_date: date | None = None
    thumbnail_url: str | None = Field(None, max_length=2048)


class SeasonIn(StrictModel):
    number: Nonnegative
    name: str | None = Field(None, max_length=255)
    synopsis: str | None = Field(None, max_length=100000)
    episodes: list[EpisodeIn] = Field(default_factory=list, max_length=1000)

    @model_validator(mode="after")
    def unique_episodes(self):
        if len({e.number for e in self.episodes}) != len(self.episodes):
            raise ValueError("Duplicate episode numbers")
        return self


class TitleIn(StrictModel):
    source: str = Field(pattern=r"^[a-z0-9_-]{1,32}$")
    source_id: str = Field(min_length=1, max_length=100)
    media_type: Literal["movie", "series", "anime"]
    title: str = Field(min_length=1, max_length=255)
    synopsis: str | None = Field(None, max_length=100000)
    release_year: int | None = Field(None, ge=1800, le=2200)
    rating: float | None = Field(None, ge=0, le=10, allow_inf_nan=False)
    rating_count: Nonnegative | None = None
    age_rating: str | None = Field(None, max_length=50)
    age_rating_region: str | None = Field(None, pattern=r"^[A-Z]{2}$")
    season_count: Nonnegative | None = None
    episode_count: Nonnegative | None = None
    runtime_minutes: Nonnegative | None = None
    status: str | None = Field(None, max_length=80)
    poster_url: str | None = Field(None, max_length=2048)
    backdrop_url: str | None = Field(None, max_length=2048)
    genres: list[str] = Field(default_factory=list, max_length=50)
    cast: list[CastIn] = Field(default_factory=list, max_length=500)
    # None means not fetched: preserve stored season/episode details on reimport.
    # A supplied season upserts its episodes; missing seasons/episodes are retained.
    seasons: list[SeasonIn] | None = Field(None, max_length=100)

    @field_validator("genres")
    @classmethod
    def clean_genres(cls, values):
        values = list(dict.fromkeys(v.strip() for v in values))
        if any(not v or len(v) > 100 or "/" in v for v in values):
            raise ValueError("Genres must be 1..100 characters without slashes")
        return values

    @model_validator(mode="after")
    def unique_seasons(self):
        if self.seasons is not None and len({s.number for s in self.seasons}) != len(self.seasons):
            raise ValueError("Duplicate season numbers")
        return self


class BatchIn(StrictModel):
    titles: list[TitleIn] = Field(min_length=1, max_length=100)
