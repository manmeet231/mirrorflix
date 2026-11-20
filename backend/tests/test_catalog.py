import copy
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from catalog.api import create_app
from catalog.models import Base, Title

TOKEN = "test-only-" + "a" * 32
AUTH = {"Authorization": f"Bearer {TOKEN}"}
SAMPLE = {"source": "tmdb", "source_id": "42", "media_type": "series", "title": "Example", "synopsis": "Story", "rating": 8.4,
          "age_rating": "TV-14", "age_rating_region": "US", "season_count": 1, "episode_count": 2, "genres": ["Drama", "Mystery"],
          "cast": [{"name": "Actor", "character": "Lead"}], "seasons": [{"number": 1, "name": "First", "episodes": [
              {"number": 1, "name": "Pilot", "synopsis": "A beginning", "air_date": "2026-01-01"},
              {"number": 2, "name": "Second", "synopsis": "A continuation"}]}]}


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.context = TestClient(create_app(self.engine, TOKEN))
        self.client = self.context.__enter__()

    def tearDown(self):
        self.context.__exit__(None, None, None)

    def post(self, items=None):
        return self.client.post("/api/titles/batch", json={"titles": items if items is not None else [SAMPLE]}, headers=AUTH)

    def test_write_requires_token_and_missing_configuration_fails_closed(self):
        self.assertEqual(self.client.post("/api/titles/batch", json={"titles": [SAMPLE]}).status_code, 401)
        self.assertEqual(self.client.post("/api/titles/batch", json={"titles": [SAMPLE]}, headers={"Authorization": "Bearer wrong"}).status_code, 401)
        with TestClient(create_app(self.engine, "")) as client:
            self.assertEqual(client.post("/api/titles/batch", json={"titles": [SAMPLE]}).status_code, 503)

    def test_round_trip_rich_fields_and_idempotent_upsert(self):
        first = self.post()
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()["created"], 1)
        self.assertEqual(self.post().json()["updated"], 1)
        data = self.client.get(f"/api/titles/{first.json()['ids'][0]}").json()
        self.assertEqual(data["rating"], 8.4)
        self.assertEqual(data["cast"][0]["character"], "Lead")
        self.assertEqual(data["seasons"][0]["episodes"][1]["synopsis"], "A continuation")
        self.assertEqual(data["seasons"][0]["episodes"][0]["air_date"], "2026-01-01")
        self.assertEqual(data["genres"], ["Drama", "Mystery"])
        self.assertEqual(len(self.client.get('/api/titles').json()['items']), 1)

    def test_source_identity_separates_movie_series_and_providers(self):
        movie = {**SAMPLE, "media_type": "movie", "seasons": None}
        anime = {**SAMPLE, "source": "anilist", "media_type": "anime"}
        self.assertEqual(self.post([SAMPLE, movie, anime]).json()["created"], 3)

    def test_partial_season_refresh_preserves_episodes_and_genres(self):
        title_id = self.post().json()["ids"][0]
        refresh = {**SAMPLE, "genres": ["Drama"], "seasons": None}
        self.post([refresh])
        refreshed = {**SAMPLE, "seasons": [{"number": 1, "name": "Renamed", "episodes": [{"number": 1, "name": "New pilot"}]}]}
        self.post([refreshed])
        data = self.client.get(f"/api/titles/{title_id}").json()
        self.assertEqual(len(data["seasons"][0]["episodes"]), 2)
        self.assertEqual(data["seasons"][0]["episodes"][0]["name"], "New pilot")
        self.assertEqual(data["genres"], ["Drama", "Mystery"])

    def test_pagination_and_genre_filter(self):
        self.post([SAMPLE, {**SAMPLE, "source_id": "43", "genres": ["Comedy"]}])
        result = self.client.get('/api/titles?limit=1').json()
        self.assertEqual(result['next_offset'], 1)
        self.assertEqual(len(self.client.get('/api/titles?genre=Drama').json()['items']), 1)
        self.assertEqual(self.client.get('/api/genres/Missing').status_code, 404)
        self.assertEqual(self.client.get('/api/titles/999').status_code, 404)
        self.assertEqual(self.client.get('/api/titles?limit=101').status_code, 422)

    def test_validation_and_batch_limits(self):
        cases = [[{**SAMPLE, "rating": 11}], [{**SAMPLE, "title": " "}], [SAMPLE, SAMPLE],
                 [{**SAMPLE, "seasons": [{"number": 1, "episodes": [{"number": 1}, {"number": 1}]}]}],
                 [{**SAMPLE, "genres": [" "]}], []]
        for items in cases:
            with self.subTest(items=str(items)[:80]):
                self.assertEqual(self.post(items).status_code, 422)
        self.assertEqual(self.post([{**SAMPLE, 'source_id': str(n)} for n in range(101)]).status_code, 422)

    def test_transaction_rolls_back_on_second_write_failure(self):
        from catalog.api import upsert_title
        count = 0
        def fail_second(*args, **kwargs):
            nonlocal count
            count += 1
            if count == 2:
                raise IntegrityError('simulated', {}, Exception('unique'))
            return upsert_title(*args, **kwargs)
        with patch('catalog.api.upsert_title', side_effect=fail_second):
            response = self.post([SAMPLE, {**SAMPLE, 'source_id': '43'}])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.get('/api/titles').json()['items'], [])

    def test_legacy_genre_contract_and_memberships(self):
        anime = {"id": "77", "title": "Anime", "genres": ["Drama"], "matchPercentage": "85%", "rating": "TV", "year": 2020}
        for genre in ['Drama', 'Action', 'Drama']:
            response = self.client.post(f'/api/genres/{genre}/animes', json={"animes": [anime]}, headers=AUTH)
            self.assertEqual(response.status_code, 200, response.text)
        data = self.client.get('/api/genres/Action').json()['animes'][0]
        self.assertEqual(data['id'], '77')
        self.assertEqual(data['genres'], ['Action', 'Drama'])
        rows = self.client.get('/api/titles').json()['items']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['rating'], 8.5)
        self.assertEqual(rows[0]['media_type'], 'anime')

    def test_api_startup_does_not_initialize_schema(self):
        fresh = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        with TestClient(create_app(fresh, TOKEN)) as client:
            response = client.get('/api/titles')
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('SELECT', response.text)
            self.assertEqual(client.get('/api/health').status_code, 200)

    def test_request_size_is_bounded(self):
        response = self.client.post('/api/titles/batch', content=b'x' * (4 * 1024 * 1024 + 1), headers={**AUTH, 'Content-Type': 'application/json'})
        self.assertEqual(response.status_code, 413)
