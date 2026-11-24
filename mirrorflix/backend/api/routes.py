"""HTTP routes for catalog reads and AniList synchronization."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from logging_config import logger
from services.db_client import DatabaseAPIError, get_db_client

router = APIRouter()

VALID_STATUSES = {"RELEASING", "FINISHED", "NOT_YET_RELEASED"}
DEFAULT_STATUSES = ["RELEASING", "FINISHED", "NOT_YET_RELEASED"]
EMPTY_SYNC_RESULT = {
    "total_anime": 0,
    "genres_updated": 0,
    "entries_added": 0,
    "entries_skipped": 0,
    "errors": [],
    "by_genre": {},
}

# Process-local status. It is intentionally not a durable job history.
_sync_state = {"is_syncing": False, "last_sync": None, "total_animes": 0}


def raise_database_http_error(error: DatabaseAPIError):
    """Preserve client errors and report upstream/server failures as bad gateways."""
    status = error.status_code if 400 <= error.status_code < 500 else 502
    raise HTTPException(status_code=status, detail=error.detail) from error


@router.get("/health")
async def health_check():
    """Report whether this service is running; does not call downstream services."""
    return {"status": "healthy", "message": "MirrorFlix AniList Sync Service is running"}


@router.get("/sync/status")
async def sync_status():
    """Return sync state for the current Python process."""
    return {
        "is_syncing": _sync_state["is_syncing"],
        "last_sync": _sync_state["last_sync"],
        "total_animes_synced": _sync_state["total_animes"],
    }


@router.get("/genres")
async def list_genres():
    """Proxy the complete genre catalog from the configured database API."""
    try:
        return await get_db_client().get_genres()
    except DatabaseAPIError as error:
        logger.error("Error fetching genres: %s", error)
        raise_database_http_error(error)


@router.get("/genres/{genre_name}")
async def get_genre(genre_name: str):
    """Proxy one URL-encoded genre from the configured database API."""
    try:
        return await get_db_client().get_genre(genre_name)
    except DatabaseAPIError as error:
        logger.error("Error fetching genre %s: %s", genre_name, error)
        raise_database_http_error(error)


@router.post("/genres/{genre_name}/animes")
async def post_anime_to_genre(genre_name: str, animes: List[Dict[str, Any]]):
    """Forward a raw anime array as the database API's {"animes": [...]} payload."""
    result = await get_db_client().post_anime_to_genre(genre_name, animes)
    status = result.get("status", 502)
    if not 200 <= status < 300:
        raise HTTPException(
            status_code=status if 400 <= status < 500 else 502,
            detail=result.get("data") or result.get("error", "Database sync failed"),
        )
    return result.get("data", {"success": True, "message": "Anime added successfully"})


@router.post("/fetch-anime")
async def fetch_anime_sync(
    status_filters: Optional[List[str]] = Query(
        None, description="Repeat for each status: RELEASING, FINISHED, NOT_YET_RELEASED"
    ),
    per_page: int = Query(50, ge=1, le=50),
    max_pages_per_status: int = Query(100, ge=1, le=100),
    target_total: int = Query(5000, ge=1, le=100000),
    skip_existing: bool = Query(True),
):
    """Fetch, deduplicate, map, and synchronize anime in one foreground request."""
    if _sync_state["is_syncing"]:
        raise HTTPException(status_code=429, detail="Sync already in progress. Please wait.")

    statuses = list(dict.fromkeys(
        status.upper() for status in (status_filters or DEFAULT_STATUSES)
    ))
    invalid_statuses = sorted(set(statuses) - VALID_STATUSES)
    if invalid_statuses:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Unsupported AniList status filter.",
                "invalid": invalid_statuses,
                "allowed": sorted(VALID_STATUSES),
            },
        )

    _sync_state.update(is_syncing=True, last_sync=None)
    logger.info(
        "Starting sync: statuses=%s, per_page=%s, max_pages=%s, target=%s, skip_existing=%s",
        statuses, per_page, max_pages_per_status, target_total, skip_existing,
    )

    try:
        from services import (
            fetch_anime_status_paginated,
            get_existing_anime_ids,
            sync_anime_to_db,
        )
        from services.mapping_service import map_anime_to_db

        existing_ids = await get_existing_anime_ids() if skip_existing else set()
        seen_ids = set(existing_ids)
        all_anime = []

        for status in statuses:
            remaining = target_total - len(all_anime)
            if remaining <= 0:
                break
            anime_batch, reached_target = await fetch_anime_status_paginated(
                status=status,
                per_page=per_page,
                max_pages=max_pages_per_status,
                seen_ids=seen_ids,
                target_total=remaining,
            )
            all_anime.extend(anime_batch)
            logger.info("After %s: %d total unique anime", status, len(all_anime))
            if reached_target:
                break

        if not all_anime:
            _sync_state.update(last_sync="completed", total_animes=0)
            return {
                "success": True,
                "message": "No new anime to sync (all already in database)",
                "result": EMPTY_SYNC_RESULT.copy(),
            }

        mapped_anime = [map_anime_to_db(anime) for anime in all_anime]
        result = await sync_anime_to_db(mapped_anime)
        _sync_state.update(
            last_sync="completed", total_animes=result["entries_added"]
        )
        logger.info("Sync completed: %s", result)
        return {
            "success": True,
            "message": f"Sync completed successfully. Added {result['entries_added']} new anime.",
            "result": result,
        }
    except Exception as error:
        _sync_state["last_sync"] = "failed"
        logger.exception("Sync failed")
        raise HTTPException(status_code=500, detail=f"Sync failed: {error}") from error
    finally:
        _sync_state["is_syncing"] = False