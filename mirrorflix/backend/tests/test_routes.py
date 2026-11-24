import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from api import routes
from main import app


class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)

    def setUp(self):
        routes._sync_state.update(is_syncing=False, last_sync=None, total_animes=0)

    def test_root_and_health_are_local(self):
        root = self.client.get("/")
        health = self.client.get("/api/health")

        self.assertEqual(root.status_code, 200)
        self.assertEqual(root.json()["status"], "running")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["status"], "healthy")

    def test_sync_rejects_invalid_status_and_pagination(self):
        invalid_status = self.client.post("/api/fetch-anime?status_filters=UNKNOWN")
        invalid_page_size = self.client.post("/api/fetch-anime?per_page=51")

        self.assertEqual(invalid_status.status_code, 422)
        self.assertIn("UNKNOWN", invalid_status.json()["detail"]["invalid"])
        self.assertEqual(invalid_page_size.status_code, 422)

    def test_empty_sync_updates_process_state(self):
        with patch("services.get_existing_anime_ids", new=AsyncMock(return_value={"1"})), patch(
            "services.fetch_anime_status_paginated", new=AsyncMock(return_value=([], False))
        ):
            response = self.client.post(
                "/api/fetch-anime?status_filters=RELEASING&target_total=1"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["result"]["total_anime"], 0)
        self.assertEqual(routes._sync_state["last_sync"], "completed")
        self.assertFalse(routes._sync_state["is_syncing"])

    def test_genre_proxy_preserves_downstream_not_found(self):
        client = unittest.mock.Mock()
        client.get_genre = AsyncMock(
            side_effect=routes.DatabaseAPIError(404, {"detail": "Genre not found"})
        )
        with patch("api.routes.get_db_client", return_value=client):
            response = self.client.get("/api/genres/Missing")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"]["detail"], "Genre not found")


if __name__ == "__main__":
    unittest.main()
