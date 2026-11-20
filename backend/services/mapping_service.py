"""Mapping service for transforming AniList data to the database schema."""
from collections import defaultdict
from typing import Any, Dict, List


STATUS_MAPPINGS = {
    "RELEASING": "Currently Airing",
    "NOT_YET_RELEASED": "Upcoming",
    "FINISHED": "Completed",
    "HIATUS": "Hiatus",
    "CANCELLED": "Cancelled"
}


def map_anime_to_db(anime: Dict) -> Dict[str, Any]:
    """
    Map AniList anime data to the database JSON structure (25 fields).
    
    Args:
        anime: AniList anime data dictionary
        
    Returns:
        Mapped anime object with 25 database fields
    """
    # Handle title
    title = anime.get("title", {})
    title_english = title.get("english") or title.get("romaji") or title.get("native") or ""
    
    # Handle cover image
    cover = anime.get("coverImage", {})
    poster = anime.get("bannerImage") or cover.get("extraLarge")
    thumbnail = cover.get("medium")
    
    # Handle duration
    duration = anime.get("duration")
    duration_str = f"{duration} min" if duration else None
    
    # Handle episodes
    episodes = anime.get("episodes")
    seasons_str = f"{episodes} Episodes" if episodes else None
    
    # Handle rating/score
    avg_score = anime.get("averageScore")
    match_percentage = f"{avg_score}%" if avg_score else None
    
    # Handle age rating
    age_rating = "18+" if anime.get("isAdult") else "U/A"
    
    # Handle season and year
    season_year_str = anime.get("seasonYear")
    season_str = anime.get("season")
    
    # Handle next airing episode
    nae = anime.get("nextAiringEpisode")
    next_airing_episode = {
        "episode": nae.get("episode") if nae else None,
        "airingAt": nae.get("airingAt") if nae else None
    } if nae else None
    
    # Build the 25-field database object
    db_anime = {
        "id": str(anime.get("id")) if anime.get("id") else "",
        "malId": anime.get("idMal"),
        "title": title_english,
        "description": anime.get("description", ""),
        "poster": poster,
        "thumbnail": thumbnail,
        "backdrop": anime.get("bannerImage"),
        "genres": anime.get("genres", []),
        "matchPercentage": match_percentage,
        "ageRating": age_rating,
        "seasons": seasons_str,
        "year": season_year_str,
        "rating": anime.get("format") or "",
        "duration": duration_str,
        "status": STATUS_MAPPINGS.get(anime.get("status"), anime.get("status", "")),
        "season": season_str,
        "seasonYear": season_year_str,
        "popularity": anime.get("popularity"),
        "nextAiringEpisode": next_airing_episode,
        "streamUrl": None,
        "episodes": [],
        "isAdult": bool(anime.get("isAdult", False)),
        "synonyms": anime.get("synonyms", []),
        "coverImage": {
            "extraLarge": cover.get("extraLarge"),
            "large": cover.get("large"),
            "medium": cover.get("medium"),
            "color": cover.get("color")
        },
        "bannerImage": anime.get("bannerImage")
    }
    
    return db_anime


def categorize_anime_status(anime: Dict) -> str:
    """
    Categorize anime by status field.
    
    Args:
        anime: Anime data dictionary
        
    Returns:
        Categorized status string (Currently Airing, Upcoming, Completed, etc.)
    """
    return STATUS_MAPPINGS.get(anime.get("status"), anime.get("status", ""))


def build_genre_endpoint_options(anime_list: List[Dict]) -> List[Dict]:
    """
    Build post options that match your API requirements.
    
    Args:
        anime_list: List of mapped anime objects
        
    Returns:
        List of endpoint options with anime data
    """
    # Group by genre/name if multiple genres exist
    # For each unique genre, create a POST option with that genre's anime
    
    # Group by primary genre (first genre in array or genre field itself)
    genre_anime = defaultdict(list)
    
    for anime in anime_list:
        genres = anime.get("genres") or []
        primary_genre = genres[0] if genres else "Uncategorized"
        genre_anime[primary_genre].append(anime)
    
    # Build endpoint options
    endpoint_options = []
    for genre, anime_list in genre_anime.items():
        endpoint_options.append({
            "genre_name": genre,
            "anime_list": anime_list
        })
    
    return endpoint_options