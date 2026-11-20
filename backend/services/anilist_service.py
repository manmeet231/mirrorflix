"""AniList service for fetching anime data via GraphQL API."""
import asyncio
import os
import time
from typing import Any, Dict, List, Optional

import aiohttp

from logging_config import logger

ANILIST_API = os.getenv("ANILIST_API", "https://graphql.anilist.co")

ANILIST_QUERY = """
    query GetAnimeBatch($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus) {
        Page(page: $page, perPage: $perPage) {
            pageInfo { total currentPage lastPage hasNextPage }
            media(type: ANIME, status: $status, sort: $sort) {
                id
                idMal
                title { romaji english native }
                description
                coverImage { extraLarge large medium color }
                bannerImage
                genres
                season
                seasonYear
                format
                status
                episodes
                duration
                averageScore
                popularity
                isAdult
                synonyms
                nextAiringEpisode { episode airingAt }
                startDate { year month day }
                endDate { year month day }
            }
        }
    }
"""


class AniListService:
    """Service for interacting with the AniList GraphQL API."""

    def __init__(self, timeout: int = 30, max_retries: int = 5):
        self.api_url = ANILIST_API
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.max_retries = max_retries

    async def _make_request(self, graphql_query: str, variables: Dict, session: aiohttp.ClientSession) -> Dict:
        payload = {"query": graphql_query, "variables": variables}

        for attempt in range(self.max_retries):
            try:
                async with session.post(
                    self.api_url,
                    json=payload,
                    timeout=self.timeout
                ) as response:
                    # Check rate limit headers
                    rate_limit_remaining = response.headers.get("X-RateLimit-Remaining")
                    rate_limit_reset = response.headers.get("X-RateLimit-Reset")
                    retry_after = response.headers.get("Retry-After")
                    
                    if rate_limit_remaining is not None:
                        logger.debug(f"AniList rate limit remaining: {rate_limit_remaining}")
                    
                    if response.status == 200:
                        data = await response.json()
                        if 'data' in data:
                            return data['data']
                        elif 'errors' in data:
                            error_msg = data['errors'][0].get('message', 'Unknown error')
                            raise Exception(f"AniList error: {error_msg}")
                        raise Exception("No data returned from AniList")
                    elif response.status == 429:
                        # Rate limited - use Retry-After header if available, otherwise exponential backoff
                        if retry_after:
                            try:
                                wait_time = int(retry_after)
                            except ValueError:
                                wait_time = 60
                        elif rate_limit_reset:
                            try:
                                wait_time = max(int(rate_limit_reset) - int(time.time()), 1)
                            except (ValueError, OSError):
                                wait_time = 60
                        else:
                            wait_time = 60 * (attempt + 1)  # 60s, 120s, 180s...
                        
                        logger.warning(f"AniList rate limited (429). Waiting {wait_time}s before retry {attempt + 1}/{self.max_retries}")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise Exception(f"HTTP {response.status}: {await response.text()}")

            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt == self.max_retries - 1:
                    raise Exception(f"AniList request failed after {self.max_retries} retries: {str(e)}")
                logger.warning(f"Attempt {attempt + 1} failed: {e}, retrying...")
                await asyncio.sleep(2 ** attempt)

        raise RuntimeError(f"AniList request failed after {self.max_retries} attempts")

    async def fetch_anime_batch(
        self,
        page: int = 1,
        per_page: int = 50,
        sort: Optional[List[str]] = None,
        status_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        variables = {
            "page": page,
            "perPage": per_page,
            "sort": sort or ["POPULARITY_DESC"],
            "status": status_filter,
        }

        async with aiohttp.ClientSession() as session:
            return await self._make_request(ANILIST_QUERY, variables, session)


async def fetch_anime_batch(
    page: int = 1,
    per_page: int = 50,
    sort: List[str] = None,
    status_filter: Optional[str] = None
) -> Dict:
    """Standalone function for backward compatibility."""
    service = AniListService()
    return await service.fetch_anime_batch(page, per_page, sort, status_filter)


async def fetch_anime_status_paginated(
    status: str = "RELEASING",
    per_page: int = 50,
    max_pages: int = 100,
    seen_ids: Optional[set] = None,
    target_total: Optional[int] = None,
) -> tuple[List[Dict], bool]:
    """Fetch new anime by status, deduplicating IDs as strings across statuses."""
    all_anime = []
    seen_ids = seen_ids if seen_ids is not None else set()
    reached_target = False
    service = AniListService()

    logger.info(
        "Fetching status %s (seen_ids=%d, target=%s)",
        status, len(seen_ids), target_total,
    )

    for page in range(1, max_pages + 1):
        data = await service.fetch_anime_batch(
            page=page, per_page=per_page, status_filter=status
        )
        page_data = data.get("Page", {})
        media_list = page_data.get("media", [])
        new_anime = []

        for anime in media_list:
            raw_id = anime.get("id")
            if raw_id is None:
                continue
            anime_id = str(raw_id)
            if anime_id in seen_ids:
                logger.debug("Skipping duplicate anime ID: %s", anime_id)
                continue

            seen_ids.add(anime_id)
            new_anime.append(anime)
            if target_total is not None and len(all_anime) + len(new_anime) >= target_total:
                reached_target = True
                break

        all_anime.extend(new_anime)
        logger.info(
            "Fetched page %d: %d total, %d new (cumulative: %d)",
            page, len(media_list), len(new_anime), len(all_anime),
        )
        if reached_target or not page_data.get("pageInfo", {}).get("hasNextPage"):
            break
        await asyncio.sleep(3.5)

    logger.info("Total new anime fetched for %s: %d", status, len(all_anime))
    return all_anime, reached_target