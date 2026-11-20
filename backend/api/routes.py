"""API routes for AniList sync and database operations."""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
from logging_config import logger

# Load environment variables
load_dotenv()

router = APIRouter()

# Store sync state in memory
_sync_state = {
    "is_syncing": False,
    "last_sync": None,
    "total_animes": 0
}


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "message": "MirrorFlix AniList Sync Service is running"}


@router.get("/sync/status")
async def sync_status():
    """Get sync status."""
    return {
        "is_syncing": _sync_state["is_syncing"],
        "last_sync": _sync_state["last_sync"],
        "total_animes_synced": _sync_state["total_animes"]
    }


@router.get("/genres")
async def list_genres():
    """List all genres from your database."""
    logger.info("GET /genres requested")
    try:
        from db_client import get_db_client
        client = get_db_client()

        async with client.session as sess:
            if sess is None:
                await client.start_session()

            async with sess.get("http://127.0.0.1:8001/api/genres") as response:
                data = await response.json()
                return data

        await client.close()
    except Exception as e:
        logger.error(f"Error fetching genres: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/genres/{genre_name}")
async def get_genre(genre_name: str):
    """Get a single genre by name."""
    logger.info(f"GET /genres/{genre_name} requested")
    try:
        from db_client import get_db_client
        client = get_db_client()

        async with client.session as sess:
            if sess is None:
                await client.start_session()

            url = f"http://127.0.0.1:8001/api/genres/{genre_name}"
            async with sess.get(url) as response:
                if response.status == 404:
                    raise HTTPException(status_code=404, detail="Genre not found")
                data = await response.json()
                return data

        await client.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching genre {genre_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/genres/{genre_name}/animes")
async def post_anime_to_genre(
    genre_name: str,
    animes: List[Dict[str, Any]]
):
    """Post anime data to a genre."""
    logger.info(f"POST /genres/{genre_name}/animes: {len(animes)} anime")

    from db_client import get_db_client
    client = get_db_client()

    try:
        db_res = await client.post_anime_to_genre(genre_name, animes)

        if db_res.get("status") == 409:
            raise HTTPException(status_code=409, detail=db_res.get("data", {}))

        return db_res.get("data", {"success": True, "message": "Anime added successfully"})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error posting anime to {genre_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fetch-anime")
async def fetch_anime_sync(
    status_filters: Optional[List[str]] = None,
    per_page: int = 50,
    max_pages_per_status: int = 100,
    target_total: int = 5000,
    skip_existing: bool = True
):
    """
    Fetch anime from AniList and sync to database (multi-status with deduplication).

    - status_filters: List of statuses to fetch (default: all 3)
    - per_page: Anime per page (max 50)
    - max_pages_per_status: Max pages per status (max 100)
    - target_total: Stop after this many unique anime
    - skip_existing: Fetch existing IDs from DB first to avoid re-fetching
    """
    global _sync_state

    if _sync_state["is_syncing"]:
        raise HTTPException(
            status_code=429,
            detail="Sync already in progress. Please wait."
        )

    # Default to all three statuses
    if status_filters is None:
        status_filters = ["RELEASING", "FINISHED", "NOT_YET_RELEASED"]

    _sync_state["is_syncing"] = True
    _sync_state["last_sync"] = None

    logger.info(f"Starting sync: statuses={status_filters}, per_page={per_page}, max_pages_per_status={max_pages_per_status}, target_total={target_total}, skip_existing={skip_existing}")

    try:
        from services import fetch_anime_status_paginated, sync_anime_to_db, get_existing_anime_ids
        from services.mapping_service import map_anime_to_db

        # Step 1: Get existing anime IDs from database (if skip_existing)
        existing_ids = await get_existing_anime_ids() if skip_existing else set()
        logger.info(f"Loaded {len(existing_ids)} existing anime IDs from database")

        # Step 2: Fetch from each status, accumulating until target_total
        all_anime = []
        seen_ids = set(existing_ids)  # Track all seen IDs for cross-status deduplication

        for status in status_filters:
            if target_total and len(all_anime) >= target_total:
                break

            remaining = target_total - len(all_anime) if target_total else None
            
            anime_batch, reached_target = await fetch_anime_status_paginated(
                status=status,
                per_page=per_page,
                max_pages=max_pages_per_status,
                seen_ids=seen_ids,
                target_total=remaining
            )
            
            all_anime.extend(anime_batch)
            logger.info(f"After {status}: {len(all_anime)} total unique anime")

            if reached_target:
                break

        if not all_anime:
            logger.info("No new anime to sync")
            return {
                "success": True,
                "message": "No new anime to sync (all already in database)",
                "result": {
                    "total_anime": 0,
                    "genres_updated": 0,
                    "entries_added": 0,
                    "entries_skipped": 0,
                    "errors": [],
                    "by_genre": {}
                }
            }

        # Step 3: Map and sync (database will handle final deduplication)
        logger.info(f"Mapping {len(all_anime)} anime to database schema")
        mapped_anime = [map_anime_to_db(anime) for anime in all_anime]
        
        logger.info(f"Syncing {len(mapped_anime)} anime to database")
        result = await sync_anime_to_db(mapped_anime)

        _sync_state["last_sync"] = "completed"
        _sync_state["total_animes"] = result["entries_added"]

        logger.info(f"Sync completed: {result}")
        return {
            "success": True,
            "message": f"Sync completed successfully. Added {result['entries_added']} new anime.",
            "result": result
        }

    except Exception as e:
        _sync_state["last_sync"] = "failed"
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

    finally:
        _sync_state["is_syncing"] = False