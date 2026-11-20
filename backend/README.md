# MirrorFlix AniList Sync Service

FastAPI service for proxying the external genre database and synchronizing AniList anime into it.

The complete and authoritative documentation is [../backend.md](../backend.md), including configuration, all endpoints, query parameters, payloads, response schemas, error behavior, tests, and security notes.

## Quick start

```powershell
pip install -r requirements.txt
Copy-Item .env.example .env
python main.py
```

Run from this `backend/` directory. The service defaults to `http://127.0.0.1:8002`; OpenAPI UI is at `/docs`. The separate database API defaults to `http://127.0.0.1:8001` and is not implemented in this repository.

## Offline tests

```powershell
pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

`test_api.py` is a live integration script, not an offline unit test; it writes to the configured database.
