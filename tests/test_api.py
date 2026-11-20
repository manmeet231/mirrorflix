import os
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:///:memory:",
)

from backend.database import get_db  # noqa: E402
from backend.main import _flatten_anime, _serialize_movie, app  # noqa: E402


@pytest.fixture
def client():
    from unittest.mock import MagicMock

    db = MagicMock()
    query = MagicMock()
    db.query.return_value = query
    query.join.return_value = query
    query.outerjoin.return_value = query
    query.filter.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query
    query.offset.return_value = query
    query.all.return_value = []
    query.count.return_value = 0
    query.first.return_value = None
    db.execute.return_value = 1

    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client, db, query
    app.dependency_overrides.clear()


def test_health_checks_database(client):
    test_client, db, _ = client

    response = test_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
    db.execute.assert_called_once()


def test_movie_list_has_empty_pagination_shape(client):
    test_client, _, _ = client

    response = test_client.get("/api/movies?limit=10&offset=5")

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "total": 0,
        "limit": 10,
        "offset": 5,
        "hasMore": False,
    }


def test_featured_endpoint_keeps_list_response(client):
    test_client, _, _ = client

    response = test_client.get("/api/movies/featured")

    assert response.status_code == 200
    assert response.json() == []


def test_invalid_pagination_is_rejected(client):
    test_client, _, _ = client

    response = test_client.get("/api/movies?limit=101")

    assert response.status_code == 422


def test_missing_movie_returns_404(client):
    test_client, _, _ = client

    response = test_client.get("/api/movies/9999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Movie not found"


def test_anime_is_deduplicated_and_genres_are_combined():
    anime = {"id": 42, "title": "Sample", "genres": ["Drama"]}
    flattened = _flatten_anime([
        SimpleNamespace(id=1, name="Action", animes=[anime]),
        SimpleNamespace(id=2, name="Adventure", animes=[dict(anime)]),
    ])

    assert len(flattened) == 1
    assert flattened[0]["genres"] == ["Drama", "Action", "Adventure"]


def test_movie_serializer_maps_database_fields_to_card_fields():
    movie = SimpleNamespace(
        id=7,
        title="Sample",
        description="Synopsis",
        release_year=2024,
        poster_url="https://example.test/poster.jpg",
        backdrop_url=None,
        average_rating=8.5,
        total_views=12,
        category_id=3,
    )

    result = _serialize_movie(movie, "Action")

    assert result["id"] == 7
    assert result["synopsis"] == "Synopsis"
    assert result["backgroundImage"] == movie.poster_url
    assert result["genres"] == ["Action"]
    assert result["contentType"] == "movie"
    assert "streamtape_file_id" not in result


def test_development_origin_is_allowed(client):
    test_client, _, _ = client

    response = test_client.options(
        "/api/movies",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_content_write_route_fails_closed_without_admin_token(client, monkeypatch):
    test_client, _, _ = client
    monkeypatch.delenv("API_ADMIN_TOKEN", raising=False)

    response = test_client.post("/api/genres/Action/animes", json={"id": 1})

    assert response.status_code == 503
    assert response.json()["detail"] == "Content management API is not configured"


def test_content_write_route_rejects_invalid_admin_token(client, monkeypatch):
    test_client, _, _ = client
    monkeypatch.setenv("API_ADMIN_TOKEN", "test-only-token")

    response = test_client.post(
        "/api/genres/Action/animes",
        json={"id": 1},
        headers={"X-Admin-Token": "wrong-token"},
    )

    assert response.status_code == 401
