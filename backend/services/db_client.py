"""Database client for posting anime data to your API."""
import aiohttp
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from logging_config import logger
import os

# Load environment variables
load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")


class DatabaseClient:
    """Client for interfacing with your existing API endpoints."""

    def __init__(self, api_base_url: str = API_BASE_URL):
        """
        Initialize database client.
        """
        self.api_base_url = api_base_url
        self.session = None

    async def start_session(self):
        """Create a new session if one doesn't exist."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()

    async def close(self):
        """Close the current session."""
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None

    async def post_anime_to_genre(
        self,
        genre_name: str,
        anime_anime: List[Dict[str, Any]],
        session: Optional[aiohttp.ClientSession] = None
    ) -> Dict[str, Any]:
        """
        Post anime data to a specific genre.
        """
        if session is None:
            await self.start_session()
            session = self.session

        url = f"{self.api_base_url}/api/genres/{genre_name}/animes"

        if not anime_anime:
            logger.warning(f"No anime to post for genre: {genre_name}")
            return {"success": True, "message": "No anime to post"}

        try:
            async with session.post(
                url,
                json={"animes": anime_anime},
                headers={"Content-Type": "application/json"}
            ) as response:
                data = await response.json()
                logger.info(f"POST {url}: Status {response.status}")
                return {
                    "status": response.status,
                    "data": data,
                    "genre": genre_name,
                    "animes_posted": len(anime_anime)
                }

        except aiohttp.ClientError as e:
            logger.error(f"Error posting to {url}: {str(e)}")
            return {"success": False, "error": str(e), "status": 500}
        except Exception as e:
            logger.error(f"Unexpected error posting to {url}: {str(e)}")
            return {"success": False, "error": str(e), "status": 500}

    async def batch_post_animes(
        self,
        endpoint_options: List[Dict[str, List[Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Batch post anime data to multiple genres.
        """
        await self.start_session()
        results = []

        for option in endpoint_options:
            genre_name = option.get("genre_name", "Uncategorized")
            anime_anime = option.get("anime_list", [])

            result = await self.post_anime_to_genre(genre_name, anime_anime, self.session)
            results.append(result)

        return results


# Singleton instance
_db_client = None


def get_db_client() -> DatabaseClient:
    """Get or create the singleton DatabaseClient instance."""
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client


async def close_db_client():
    """Close the database client."""
    client = get_db_client()
    await client.close()


# Standalone async functions for backward compatibility
async def post_anime_to_genre(
    genre_name: str,
    anime_anime: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Async post anime data to a specific genre."""
    client = get_db_client()
    return await client.post_anime_to_genre(genre_name, anime_anime)


async def batch_post_animes(
    endpoint_options: List[Dict[str, List[Any]]]
) -> List[Dict[str, Any]]:
    """Async batch post anime data to multiple genres."""
    client = get_db_client()
    return await client.batch_post_animes(endpoint_options)


async def get_existing_anime_ids() -> set:
    """
    Fetch all anime IDs currently in the database to avoid re-fetching.
    Returns a set of AniList IDs (as strings).
    """
    client = get_db_client()
    existing_ids = set()
    
    try:
        await client.start_session()
        # Get all genres
        async with client.session.get(f"{client.api_base_url}/api/genres") as response:
            if response.status == 200:
                genres = await response.json()
                for genre in genres:
                    animes = genre.get("animes", [])
                    for anime in animes:
                        anime_id = anime.get("id")
                        if anime_id:
                            existing_ids.add(str(anime_id))
        logger.info(f"Fetched {len(existing_ids)} existing anime IDs from database")
    except Exception as e:
        logger.warning(f"Could not fetch existing anime IDs: {e}")
    finally:
        await client.close()
    
    return existing_ids


async def sync_anime_to_db(
    anime_list: List[Dict[str, Any]],
    attempt: int = 0
) -> Dict[str, Any]:
    """
    Sync anime list to database by genre.
    Also attempts to add manga for each outlet.
    """
    result = {
        "total_anime": len(anime_list),
        "genres_updated": 0,
        "entries_added": 0,
        "entries_skipped": 0,
        "errors": [],
        "by_genre": {}
    }

    from .mapping_service import build_genre_endpoint_options
    endpoint_options = build_genre_endpoint_options(anime_list)

    for option in endpoint_options:
        try:
            genre_name = option.get("genre_name", "Uncategorized")
            genre_anime = option.get("anime_list", [])

            db_client = get_db_client()
            db_res = await db_client.post_anime_to_genre(genre_name, genre_anime)

            if db_res.get("status") in [200, 201]:
                added = db_res.get("animes_posted", len(genre_anime))
                result["genres_updated"] += 1
                result["entries_added"] += added
                result["by_genre"][genre_name] = {"added": added, "status": "success"}
                logger.info(f"Added {added} anime to genre: {genre_name}")
            elif db_res.get("status") == 409:
                result["entries_skipped"] += len(genre_anime)
                result["by_genre"][genre_name] = {"added": 0, "status": "duplicate"}
                logger.info(f"Anime already exists in genre: {genre_name}")
            else:
                raise Exception(db_res.get("error", "Unknown error"))

        except Exception as e:
            error_msg = str(e)
            result["errors"].append({genre_name: error_msg})
            result["by_genre"][genre_name] = {"added": 0, "status": f"error: {error_msg}"}
            logger.error(f"Error syncing genre {genre_name}: {error_msg}")

    return result