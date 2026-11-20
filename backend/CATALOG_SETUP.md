# Persistent catalog: MySQL, GET/POST endpoints and batch imports

This is a separately runnable catalog database API, alongside the existing AniList
sync service. Review this branch before applying anything on a VPS. No server
files, MySQL data, systemd services or firewall rules were changed during development.
The repository's backend was inspected; server-only changes have not been accessed.

## What exists and what is new

- Existing `main.py`: FastAPI sync/proxy on loopback port 8002. Its actual routes
  are `/`, `/api/health`, `/api/sync/status`, `/api/genres`,
  `/api/genres/{genre_name}`, POST `/api/genres/{genre_name}/animes` (raw array)
  and POST `/api/fetch-anime`. See `../backend.md` for all parameters. Its sync
  writes to an external API; it did not previously persist MySQL data itself.
- New `catalog_main.py`: independent FastAPI catalog on loopback port 8001,
  backed by SQLAlchemy/MySQL. Never initializes tables at startup.
- New `catalog/importer.py`: reads TMDB movie/TV metadata and posts validated
  batches to the catalog over HTTP. AniList remains available for anime metadata.
- Existing HTTP `DatabaseClient` can forward `CATALOG_WRITE_TOKEN` to the catalog.
  Existing application routes and the frontend are unchanged.

The existing VPS may already run a different service on 8001. Inspect it first;
do not replace its schema or bind a second process to an occupied port. Use a
separate database and a free loopback port for review, then explicitly plan any
migration or proxy integration. The old unauthenticated sync service must remain
private; a token on its downstream database does not authenticate its callers.

## Schema

The reviewable MySQL 8 DDL is `catalog/schema.mysql.sql`. The authoritative models
are in `catalog/models.py`. Five tables cover all requested attributes:

| Table | Data |
| --- | --- |
| catalog_titles | Source/ID/type, title, synopsis, score 0–10 and vote count, age certificate and country, reported season/episode totals, runtime, year, status, poster/backdrop, cast JSON (actor, character, provider ID), UTC update timestamp, optional legacy payload |
| catalog_genres | Unique genre names |
| catalog_title_genres | Many-to-many title/genre relationships |
| catalog_seasons | Season number (0 supports specials), name and synopsis |
| catalog_episodes | Episode number, name, synopsis, runtime, air date and thumbnail |

Source identity is UNIQUE(source, media_type, source_id): TMDB movie 42 and TV 42
are different titles. Season and episode numbers are unique inside their parents.
Imports upsert; they never delete titles. A metadata-only refresh (`seasons=null`)
preserves season/episode detail. Supplied seasons/episodes are upserted by number;
missing ones and previous genre memberships remain. Supplied scalar metadata and
cast replace the previous values, including explicit null/empty values. This is
an import contract, not a partial PATCH or delete API. Canonical import schema is
strict; unknown fields, invalid ratings, duplicate season/episode numbers, empty
titles or more than 100 titles per batch are rejected. Buffered request bodies are capped at 4 MiB (413 on excess).

Reported totals describe provider metadata, not the number of loaded rows. Unknown
values remain null; an absent score is not a zero-star rating. Age certificates
are country-specific and separate from numeric audience scores. Cast is JSON
because names/roles arrive as an ordered provider list; seasons/episodes/genres
are normalized for identity and querying. Video bytes/stream URLs are not supplied
by these metadata providers and are not invented or stored in this schema.

## Ubuntu VPS: inspect first (read-only)

Run in the existing repository root through your authenticated SSH/VS Code terminal:

```sh
pwd
git status --short
rg --files backend
sudo systemctl status alterbucket-api --no-pager
sudo ss -lntp | grep -E ':(8001|8002|3306)\b'
sudo mysql -e 'SHOW DATABASES;'
```

If rg is unavailable, list backend files with `find backend -type f` while avoiding
printing .env, keys, logs, virtualenvs or database dumps. Inspect source code,
requirements and configuration variable NAMES privately. Do not share `.env`
contents, `systemctl show` environment values or full logs containing credentials.
`sudo mysql` assumes the VPS administrator has socket-auth access; otherwise use
the administrator's existing private MySQL login method. Do not reset passwords.

## Ubuntu setup after code/schema review and production authorization

These are commands to run manually, not actions already executed on your VPS.
Use an isolated checkout so the live frontend/backend tree is not overwritten:

```sh
git clone --branch feat/catalog-backend-import https://github.com/manmeet231/mirrorflix.git "$HOME/alterbucket-catalog-review"
cd "$HOME/alterbucket-catalog-review/backend"
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
chmod 600 .env
nano .env
```

If venv is unavailable, ask the VPS administrator to install the Ubuntu
`python3-venv` package. Do not reinstall or replace an existing MySQL service.
The fresh checkout contains no live .env; never copy over a production env file.
Set DATABASE_URL, CATALOG_WRITE_TOKEN and TMDB_READ_TOKEN privately. Generate the
catalog token locally with `python -c "import secrets; print(secrets.token_urlsafe(32))"`
and store the same value in the catalog and importer environment. At least 32
characters are required. Obtain a TMDB **API Read Access Token**, not an OpenAI key,
from your TMDB account's API settings; observe TMDB terms/attribution requirements:
https://developer.themoviedb.org/docs/getting-started and
https://developer.themoviedb.org/docs/faq . TMDB attribution/logo belongs in the
product when its data is displayed; this backend does not claim endorsement.

Use a NEW database name approved by the administrator. The example below uses
`alterbucket_catalog`; stop if that database already exists until it is inspected
and backed up. In an authenticated administrator MySQL session:

```sql
CREATE DATABASE alterbucket_catalog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'catalog_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_A_UNIQUE_PRIVATE_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON alterbucket_catalog.* TO 'catalog_app'@'127.0.0.1';
```

Replace the password locally; never commit it. Configure DATABASE_URL for that
user/host/database, URL-encoding password characters. Existing database backup
commands must use your administrator's existing credentials, e.g.:

```sh
umask 077
sudo mysqldump --single-transaction --databases alterbucket_catalog > catalog-before-import.sql
python -m catalog.init_db
```

Initialization only creates missing `catalog_*` tables; it cannot migrate an old
incompatible table. No ALTER/DROP is run. Do not execute the review DDL repeatedly
as a migration script. After initial table creation, revoke temporary DDL privileges
in the administrator MySQL session:

```sql
REVOKE CREATE, INDEX, REFERENCES ON alterbucket_catalog.* FROM 'catalog_app'@'127.0.0.1';
```

Start in the foreground on a FREE loopback port (8001 below is an example):

```sh
python -m uvicorn catalog_main:app --host 127.0.0.1 --port 8001
```

Uvicorn runs the application; the application connects to MySQL. The importer
connects to Uvicorn's HTTP API, not directly to the database. Database connections
use pool_pre_ping and hidden SQL parameters. SQL/connection failures return a
sanitized 503. HTTPS/public reverse-proxy routes are not configured by this change.
No need to open 3306, 8001, 8002 or another SSH port publicly. Review an appropriate
systemd unit and Nginx integration separately before permanent deployment; do not
restart the existing `alterbucket-api` just to test this new app.

## Endpoints and exact local URLs

With the catalog listening on 8001:

| Method | URL | Contract |
| --- | --- | --- |
| GET | http://127.0.0.1:8001/docs | Generated interactive OpenAPI docs |
| GET | http://127.0.0.1:8001/openapi.json | Machine-readable endpoint schemas |
| GET | http://127.0.0.1:8001/api/health | SELECT 1 connectivity check; not a table/migration check |
| GET | http://127.0.0.1:8001/api/titles?limit=20&offset=0 | items, limit, offset, next_offset; optional media_type/genre filters |
| GET | http://127.0.0.1:8001/api/titles/1 | Rich title with cast, genres, seasons and episode details; 404 if missing |
| POST | http://127.0.0.1:8001/api/titles/batch | Bearer token; {"titles":[...]} up to 100 titles, all-or-nothing transaction |
| GET | http://127.0.0.1:8001/api/genres | Legacy-compatible genre array; limit/offset, per_genre up to 100 |
| GET | http://127.0.0.1:8001/api/genres/Drama?limit=20&offset=0 | Genre with legacy animes and next_offset |
| POST | http://127.0.0.1:8001/api/genres/Drama/animes | Bearer token; legacy wrapper {"animes":[...]} up to 100 |

The existing sync server on 8002 instead accepts a raw array at its genre POST
route, then wraps it for the database API. Do not confuse the two payloads. The
new legacy adapter preserves original AniList fields in JSON but does not infer
season structure from strings like "24 Episodes". Prefer canonical `/titles/batch`
for rich imports. Legacy GET output uses an `animes` key for compatibility even
when the catalog contains other media types. It has no playable episode URLs.
AniList legacy IDs remain plain provider IDs; other provider/type IDs are prefixed
to avoid collisions. Existing sync deduplication only reads the bounded legacy
pages; very large catalogs may be re-fetched, but unique database identities avoid
duplicate rows. Use the new paginated importer for large jobs.

Example authenticated payload file (no credentials in it):

```json
{"titles":[{"source":"manual","source_id":"example-1","media_type":"series",
"title":"Example series","synopsis":"Show synopsis","rating":8.2,
"age_rating":"TV-14","age_rating_region":"US","season_count":1,"episode_count":1,
"genres":["Drama"],"cast":[{"name":"Example actor","character":"Lead"}],
"seasons":[{"number":1,"name":"Season 1","episodes":[{"number":1,
"name":"Pilot","synopsis":"Episode synopsis","runtime_minutes":24}]}]}]}
```

Save as `sample-title.json`. From a second terminal in backend/ with the virtualenv:

```sh
python - <<'PY'
import os, json, httpx
from dotenv import load_dotenv
load_dotenv('.env')
headers = {'Authorization': 'Bearer ' + os.environ['CATALOG_WRITE_TOKEN']}
with open('sample-title.json') as handle:
    payload = json.load(handle)
r = httpx.post('http://127.0.0.1:8001/api/titles/batch', headers=headers, json=payload)
r.raise_for_status()
print(r.json())
PY
curl --fail http://127.0.0.1:8001/api/titles
```

Writes fail closed (503) when the token is absent/too short; missing/wrong bearer
tokens get 401. Validation returns 422, concurrency conflicts 409 (safe to retry),
and sanitized database failures 503. Do not put bearer tokens in a public HTTP URL
or browser VITE_* variable. For remote administration use HTTPS or an authenticated
SSH local-forward to the loopback listener. The importer refuses non-loopback
plain HTTP URLs and embedded URL credentials. Redirects are not followed, preventing
provider/catalog credentials from being forwarded to a redirect target.

## Batch imports

Default is DRY RUN: fetch and validate but do not POST/database-write. Run from
backend/ with the virtualenv active and private .env configured:

```sh
python scripts/import_catalog.py --provider tmdb --media movie --pages 1 --max-items 5
python scripts/import_catalog.py --provider tmdb --media series --pages 1 --max-items 2 --region IN
```

Age-rating country defaults to US; explicitly choose the desired country. After
review, add `--write` to persist:

```sh
python scripts/import_catalog.py --provider tmdb --media movie --pages 2 --max-items 40 --batch-size 20 --write
python scripts/import_catalog.py --provider tmdb --media series --pages 1 --max-items 5 --batch-size 5 --region IN --write
```

Series fetches every available listed season (including specials) and episode
name/synopsis/cast metadata. API omissions remain null/empty; counts reflect
provider-reported totals. Extremely large titles exceeding validation limits stop
the job rather than silently truncate. TMDB discovery uses popularity order;
changing provider catalogs mean page-based resume is best effort, not a snapshot.
Use `--skip-seasons` for later metadata-only refreshes without erasing stored details.

For anime-only imports without a provider key:

```sh
python scripts/import_catalog.py --provider anilist --media anime --pages 1 --max-items 5
```

AniList does not provide a conventional season list or episode titles/synopses in
this query. These remain unavailable. Japanese voice cast is limited to the first
50 characters returned by AniList; it is not a complete international dub cast.
TMDB credits are title-level, not a separately fetched guest cast per episode.
TVmaze is suitable for TV series and episode metadata but is not a movie provider;
there is no TVmaze importer in this implementation and no guessed cross-provider
ID merge. It can be added later with source='tvmaze' if desired.

Each batch is independently transactional. Earlier successful batches remain if a
later provider call/write fails. Reprocess the LAST 'Fetching provider page N'
with `--start-page N`; duplicates update safely. Bounded request retries handle
429/5xx, network errors and catalog 409 conflicts, with rate delays and timeouts.
Very long requested rate waits stop for a later rerun. No automatic endless sync,
cron job or production import was enabled. Do not run multiple importers
concurrently until the data/job operational policy is reviewed.

## Rollback and verification

Code rollback: stop only the new foreground test server; existing services remain.
Schema/import rollback: do not DROP or DELETE live tables. Inspect and restore an
approved backup to a separate database, validate it, then plan a controlled switch.
The importer does not have a destructive rollback/delete command.

Offline tests: `python -m unittest discover -s tests -v`. They cover authentication,
validation, rich persistence, idempotency, page limits, rollback, legacy compatibility,
provider mapping, retries, dry-run/no-write behaviour and credential separation.
Real MySQL 8.4 smoke tests were run in an isolated local container; details and
production limitations are in the PR. No TMDB live account or VPS database was used.
