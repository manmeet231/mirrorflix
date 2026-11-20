"""Test script to verify the API is working."""
import asyncio
from services.anilist_service import fetch_anime_batch
from services.mapping_service import map_anime_to_db
from services.db_client import sync_anime_to_db


async def test_fetch_anime():
    """Test fetching anime from AniList."""
    print("=" * 60)
    print("Testing AniList Integration")
    print("=" * 60)
    
    # Test 1: Fetch a batch of anime
    print("\n1. Fetching anime from AniList...")
    anime_data = await fetch_anime_batch(page=1, per_page=5)
    
    if anime_data:
        media_list = anime_data.get("Page", {}).get("media", [])
        print(f"   ✓ Successfully fetched {len(media_list)} anime")
        
        if media_list:
            # Test 2: Map anime to database format
            print("\n2. Mapping anime to database format...")
            mapped_anime = [map_anime_to_db(anime) for anime in media_list[:1]]
            if mapped_anime:
                print(f"   ✓ Mapped to database format")
                anime = mapped_anime[0]
                print(f"     - Title: {anime['title']}")
                print(f"     - Genres: {anime['genres']}")
                print(f"     - ID: {anime['id']}")
                print(f"     - MalID: {anime['malId']}")
                print(f"     - Status: {anime['status']}")
                print(f"     - Duration: {anime['duration']}")
            
            # Test 3: Sync to database (skips duplicate)
            print("\n3. Syncing to database...")
            result = await sync_anime_to_db(mapped_anime)
            print(f"   ✓ Sync completed:")
            print(f"     - Total anime: {result['total_anime']}")
            print(f"     - Genres updated: {result['genres_updated']}")
            print(f"     - Entries added: {result['entries_added']}")
    
    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        asyncio.run(test_fetch_anime())
    except KeyboardInterrupt:
        print("\nTest interrupted.")
    except Exception as e:
        print(f"\nTest failed with error: {e}")
        import traceback
        traceback.print_exc()