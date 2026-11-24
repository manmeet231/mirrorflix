"""Async client and synchronization helpers for the external database API."""
import asyncio
import os
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import aiohttp

from logging_config import logger

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")


class DatabaseAPIError(Exception):
    """An error response or connection failure from the database API."""

    def __init__(self, status_code: int, detail: Any):
        self.status_code = status_code
        self.detail = detail
        super().__init__(str(detail))


class DatabaseClient:
    """Own a reusable aiohttp session and all database HTTP requests."""

    def __init__(self, api_base_url: Optional[str] = None, timeout: int = 30):
        self.api_base_url = (api_base_url or API_BASE_URL).rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.session: Optional[aiohttp.ClientSession] = None

    async def start_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=self.timeout)

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
        self.session = None

    async def _request(self, method: str, path: str, **kwargs) -> tuple[int, Any]:
        await self.start_session()
        url = f"{self.api_base_url}{path}"
        try:
            async with self.session.request(method, url, **kwargs) as response:
                try:
                    data = await response.json(content_type=None)
                except (ValueError, aiohttp.ContentTypeError):
                    data = {"detail": (await response.text())[:500]}
                if not 200 <= response.status < 300:
                    raise DatabaseAPIError(response.status, data)
                return response.status, data
        except DatabaseAPIError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError) as error:
            logger.error("Database request failed: %s %s: %s", method, url, error)
            raise DatabaseAPIError(502, "Database API is unavailable.") from error

    async def get_genres(self) -> List[Dict[str, Any]]:
        _, data = await self._request("GET", "/api/genres")
        if not isinstance(data, list):
            raise DatabaseAPIError(502, "Database API returned an invalid genre list.")
        return data

    async def get_genre(self, genre_name: str) -> Dict[str, Any]:
        path = f"/api/genres/{quote(genre_name, safe='')}"
        _, data = await self._request("GET", path)
        return data

    async def post_anime_to_genre(
        self,
        genre_name: str,
        anime_items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not anime_items:
            return {
                "status": 200,
                "data": {"success": True, "message": "No anime to post"},
                "genre": genre_name,
                "animes_posted": 0,
            }

        path = f"/api/genres/{quote(genre_name, safe='')}/animes"
        try:
            status, data = await self._request(
                "POST", path, json={"animes": anime_items}
            )
            return {
                "status": status,
                "data": data,
                "genre": genre_name,
                "animes_posted": len(anime_items),
            }
        except DatabaseAPIError as error:
            return {
                "status": error.status_code,
                "data": error.detail,
                "error": str(error),
                "genre": genre_name,
                "animes_posted": 0,
            }

    async def batch_post_animes(
        self, endpoint_options: List[Dict[str, List[Any]]]
    ) -> List[Dict[str, Any]]:
        results = []
        for option in endpoint_options:
            result = await self.post_anime_to_genre(
                option.get("genre_name", "Uncategorized"),
                option.get("anime_list", []),
            )
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
    try:
        genres = await client.get_genres()
        existing_ids = {
            str(anime["id"])
            for genre in genres
            for anime in genre.get("animes", [])
            if anime.get("id") is not None
        }
        logger.info("Fetched %d existing anime IDs from database", len(existing_ids))
        return existing_ids
    except DatabaseAPIError as error:
        logger.warning("Could not fetch existing anime IDs: %s", error)
        return set()


async def sync_anime_to_db(anime_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Group mapped anime by primary genre and post each group sequentially."""
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