import unittest
from unittest.mock import AsyncMock

from services.anilist_service import fetch_anime_status_paginated, AniListService
from services.db_client import DatabaseClient


class DatabaseClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_genre_names_are_url_encoded(self):
        client = DatabaseClient("http://database.example/")
        client._request = AsyncMock(return_value=(200, {"name": "Slice of Life"}))

        result = await client.get_genre("Slice of Life")

        self.assertEqual(result["name"], "Slice of Life")
        client._request.assert_awaited_once_with("GET", "/api/genres/Slice%20of%20Life")

    async def test_post_wraps_raw_items_in_database_payload(self):
        client = DatabaseClient()
        client._request = AsyncMock(return_value=(201, {"success": True}))

        result = await client.post_anime_to_genre("Action", [{"id": "1"}])

        self.assertEqual(result["status"], 201)
        self.assertEqual(result["animes_posted"], 1)
        client._request.assert_awaited_once_with(
            "POST", "/api/genres/Action/animes", json={"animes": [{"id": "1"}]}
        )

    async def test_empty_post_does_not_call_database(self):
        client = DatabaseClient()
        client._request = AsyncMock()

        result = await client.post_anime_to_genre("Action", [])

        self.assertEqual(result["status"], 200)
        self.assertEqual(result["animes_posted"], 0)
        client._request.assert_not_awaited()


class AniListPaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_string_ids_deduplicate_anilist_integer_ids(self):
        service = AniListService()
        service.fetch_anime_batch = AsyncMock(return_value={
            "Page": {
                "media": [{"id": 1}, {"id": 2}],
                "pageInfo": {"hasNextPage": False},
            }
        })

        original_service = AniListService
        try:
            import services.anilist_service as module
            module.AniListService = lambda: service
            anime, reached = await fetch_anime_status_paginated(
                seen_ids={"1"}, target_total=2
            )
        finally:
            module.AniListService = original_service

        self.assertEqual(anime, [{"id": 2}])
        self.assertFalse(reached)


if __name__ == "__main__":
    unittest.main()
