from sqlalchemy import select
from .models import Title, Genre, TitleGenre, Season, Episode
from .schemas import TitleIn


def upsert_title(session, item: TitleIn, *, legacy=None):
    row = session.scalar(select(Title).where(Title.source == item.source, Title.media_type == item.media_type, Title.source_id == item.source_id))
    created = row is None
    if row is None:
        row = Title(source=item.source, media_type=item.media_type, source_id=item.source_id)
        session.add(row)
    scalar = item.model_dump(exclude={"genres", "cast", "seasons"})
    for key, value in scalar.items():
        setattr(row, key, value)
    row.cast = [person.model_dump() for person in item.cast]
    if legacy is not None:
        row.legacy = legacy
    session.flush()
    # Keep old memberships; repeated genre-wise legacy posts must not erase links.
    current_genres = {link.genre.name for link in row.genre_links}
    for name in item.genres:
        if name not in current_genres:
            genre = session.scalar(select(Genre).where(Genre.name == name))
            if genre is None:
                genre = Genre(name=name)
                session.add(genre)
                session.flush()
            row.genre_links.append(TitleGenre(genre=genre))
            current_genres.add(name)
    if item.seasons is not None:
        by_season = {season.number: season for season in row.seasons}
        for season_in in item.seasons:
            season = by_season.get(season_in.number)
            if season is None:
                season = Season(number=season_in.number)
                row.seasons.append(season)
            season.name, season.synopsis = season_in.name, season_in.synopsis
            by_episode = {episode.number: episode for episode in season.episodes}
            for episode_in in season_in.episodes:
                episode = by_episode.get(episode_in.number)
                if episode is None:
                    episode = Episode(number=episode_in.number)
                    season.episodes.append(episode)
                for key, value in episode_in.model_dump().items():
                    setattr(episode, key, value)
    session.flush()
    return row, created


def serialize(row):
    keys = ("id", "source", "source_id", "media_type", "title", "synopsis", "release_year", "rating", "rating_count", "age_rating", "age_rating_region", "season_count", "episode_count", "runtime_minutes", "status", "poster_url", "backdrop_url", "cast", "updated_at")
    result = {key: getattr(row, key) for key in keys}
    result["genres"] = sorted(link.genre.name for link in row.genre_links)
    result["seasons"] = [{"number": s.number, "name": s.name, "synopsis": s.synopsis, "episodes": [{k: getattr(e, k) for k in ("number", "name", "synopsis", "runtime_minutes", "air_date", "thumbnail_url")} for e in sorted(s.episodes, key=lambda e: e.number)]} for s in sorted(row.seasons, key=lambda s: s.number)]
    return result


def legacy_item(row):
    if row.legacy:
        return {**row.legacy, "genres": sorted(link.genre.name for link in row.genre_links)}
    return {"id": row.source_id if row.source == "anilist" else f"{row.source}:{row.media_type}:{row.source_id}", "title": row.title,
            "synopsis": row.synopsis, "description": row.synopsis, "poster": row.poster_url,
            "thumbnail": row.poster_url, "backdrop": row.backdrop_url,
            "genres": sorted(link.genre.name for link in row.genre_links),
            "year": row.release_year, "ageRating": row.age_rating,
            "matchPercentage": f"{round(row.rating * 10)}%" if row.rating is not None else None,
            "seasons": row.season_count, "episodes": [], "streamUrl": None}
