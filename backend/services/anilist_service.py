"""AniList service for fetching anime data via GraphQL API."""
import aiohttp
import asyncio
import time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from logging_config import logger
import os

# Load environment variables
load_dotenv()

ANILIST_API = os.getenv("ANILIST_API", "https://graphql.anilist.co")

ANILIST_QUERY = """
    query GetAnimeBatch($page: Int, $perPage: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
            pageInfo { total currentPage lastPage hasNextPage }
            media {
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

    async def fetch_anime_batch(
        self,
        page: int = 1,
        per_page: int = 50,
        sort: List[str] = None,
        status_filter: Optional[str] = None
    ) -> Dict:
        sort = sort or ["POPULARITY_DESC"]
        
        # Build media filter with status and sort in same parentheses
        if status_filter:
            media_filter = f"media(status: {status_filter}, sort: $sort)"
        else:
            media_filter = "media(sort: $sort)"

        graphql_query = f"""
        query GetAnimeBatch($page: Int, $perPage: Int, $sort: [MediaSort]) {{
            Page(page: $page, perPage: $perPage) {{
                pageInfo {{ total currentPage lastPage hasNextPage }}
                {media_filter} {{
                    id
                    idMal
                    title {{ romaji english native }}
                    description
                    coverImage {{ extraLarge large medium color }}
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
                    nextAiringEpisode {{ episode airingAt }}
                    startDate {{ year month day }}
                    endDate {{ year month day }}
                }}
            }}
        }}
        """

        variables = {"page": page, "perPage": per_page, "sort": sort}

        async with aiohttp.ClientSession() as session:
            return await self._make_request(graphql_query, variables, session)


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
    seen_ids: set = None,
    target_total: int = None
) -> tuple[List[Dict], bool]:
    """
    Fetch anime with pagination by status.
    
    Args:
        status: AniList status filter
        per_page: Anime per page (max 50)
        max_pages: Max pages to fetch (max 100)
        seen_ids: Set of AniList IDs to skip (for deduplication)
        target_total: Stop when this many unique anime collected
        
    Returns:
        Tuple of (anime_list, reached_target)
    """
    all_anime = []
    page = 1
    seen_ids = seen_ids or set()
    reached_target = False

    logger.info(f"Fetching anime with status: {status} (seen_ids: {len(seen_ids)}, target: {target_total})")

    service = AniListService()
    try:
        while page <= max_pages:
            data = await service.fetch_anime_batch(
                page=page,
                per_page=per_page,
                status_filter=status
            )

            media_list = data.get("Page", {}).get("media", [])
            
            # Deduplicate against seen_ids
            new_anime = []
            for anime in media_list:
                anime_id = anime.get("id")
                if anime_id and anime_id not in seen_ids:
                    seen_ids.add(anime_id)
                    new_anime.append(anime)
                elif anime_id:
                    logger.debug(f"Skipping duplicate anime ID: {anime_id}")

            all_anime.extend(new_anime)
            logger.info(f"Fetched page {page}: {len(media_list)} total, {len(new_anime)} new (cumulative: {len(all_anime)})")

            page_info = data.get("Page", {}).get("pageInfo", {})
            total_pages = page_info.get("lastPage", 0)

            # Check if target reached
            if target_total and len(all_anime) >= target_total:
                all_anime = all_anime[:target_total]
                reached_target = True
                logger.info(f"Target total ({target_total}) reached for status {status}")
                break

            if not page_info.get("hasNextPage"):
                break

            page += 1
            await asyncio.sleep(3.5)  # 3.5s delay to respect AniList's 3s minimum (20 req/min)
    finally:
        pass

    logger.info(f"Total new anime fetched for {status}: {len(all_anime)}")
    return all_anime, reached_target