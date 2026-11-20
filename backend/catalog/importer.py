"""Bounded metadata imports: provider -> validated JSON -> catalog HTTP API."""
import argparse
import html
import json
import os
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import httpx
from dotenv import load_dotenv
from .schemas import TitleIn

TMDB = "https://api.themoviedb.org/3"
ANILIST = "https://graphql.anilist.co"
ANILIST_QUERY = """
query($page:Int!, $perPage:Int!) {
  Page(page:$page, perPage:$perPage) {
    pageInfo { hasNextPage }
    media(type:ANIME, sort:ID) {
      id title { english romaji native } description genres seasonYear
      averageScore episodes duration isAdult status
      coverImage { extraLarge } bannerImage
      characters(perPage:50) { edges { node { name { full } }
        voiceActors(language:JAPANESE) { id name { full } } } }
    }
  }
}
"""


class ImportFailure(Exception):
    pass


def request_json(client, method, url, **kwargs):
    """Retry transient errors only, never log credentials, URLs or response bodies."""
    for attempt in range(4):
        try:
            response = client.request(method, url, **kwargs)
        except httpx.RequestError:
            if attempt == 3:
                raise ImportFailure("Network request failed after bounded retries") from None
            time.sleep(2 ** attempt)
            continue
        if response.status_code == 429 or response.status_code >= 500 or response.status_code == 409:
            if attempt == 3:
                raise ImportFailure(f"HTTP {response.status_code} after bounded retries")
            try:
                delay = max(float(response.headers.get("Retry-After", 2 ** attempt)), 0)
            except ValueError:
                delay = 2 ** attempt
            if delay > 30:
                raise ImportFailure("Provider requested a long rate-limit wait; rerun later")
            time.sleep(delay)
            continue
        if not response.is_success:
            raise ImportFailure(f"HTTP {response.status_code}; check credentials and payload privately")
        try:
            return response.json()
        except ValueError:
            raise ImportFailure("Endpoint returned invalid JSON") from None
    raise ImportFailure("Retry limit reached")


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, value):
        self.parts.append(value)


def plain(value):
    if not value:
        return None
    parser = PlainText()
    parser.feed(value)
    return " ".join(html.unescape(" ".join(parser.parts)).split()) or None


def image(path):
    return f"https://image.tmdb.org/t/p/w780{path}" if path else None


def tmdb_title(client, listing, media, region, *, include_seasons=True):
    kind = "movie" if media == "movie" else "tv"
    extra = "credits,release_dates" if kind == "movie" else "credits,content_ratings"
    data = request_json(client, "GET", f"{TMDB}/{kind}/{listing['id']}", params={"append_to_response": extra})
    certification = None
    if kind == "movie":
        releases = next((r for r in data.get("release_dates", {}).get("results", []) if r.get("iso_3166_1") == region), {})
        certification = next((r.get("certification") for r in releases.get("release_dates", []) if r.get("certification")), None)
    else:
        certification = next((r.get("rating") for r in data.get("content_ratings", {}).get("results", []) if r.get("iso_3166_1") == region), None)
    seasons = None
    if kind == "tv" and include_seasons:
        seasons = []
        for season in data.get("seasons", []):
            time.sleep(0.25)
            detail = request_json(client, "GET", f"{TMDB}/tv/{data['id']}/season/{season['season_number']}")
            seasons.append({"number": detail["season_number"], "name": detail.get("name"), "synopsis": detail.get("overview") or None,
                "episodes": [{"number": e["episode_number"], "name": e.get("name"), "synopsis": e.get("overview") or None,
                              "runtime_minutes": e.get("runtime"), "air_date": e.get("air_date") or None, "thumbnail_url": image(e.get("still_path"))}
                             for e in detail.get("episodes", [])]})
    release = data.get("release_date") if kind == "movie" else data.get("first_air_date")
    return TitleIn(source="tmdb", source_id=str(data["id"]), media_type=media,
        title=data.get("title") or data.get("name"), synopsis=data.get("overview") or None,
        release_year=int(release[:4]) if release else None,
        rating=data.get("vote_average") if data.get("vote_count") else None,
        rating_count=data.get("vote_count"), age_rating=certification or None,
        age_rating_region=region if certification else None,
        season_count=data.get("number_of_seasons"), episode_count=data.get("number_of_episodes"),
        runtime_minutes=data.get("runtime") if kind == "movie" else next(iter(data.get("episode_run_time") or []), None),
        status=data.get("status"), poster_url=image(data.get("poster_path")), backdrop_url=image(data.get("backdrop_path")),
        genres=[g["name"] for g in data.get("genres", [])],
        cast=[{"name": p["name"], "character": p.get("character"), "source_id": str(p["id"])} for p in data.get("credits", {}).get("cast", [])], seasons=seasons)


def anilist_title(data):
    title = data.get("title") or {}
    cast = []
    seen = set()
    for edge in (data.get("characters") or {}).get("edges", []):
        for person in edge.get("voiceActors") or []:
            key = (person["id"], (edge.get("node") or {}).get("name", {}).get("full"))
            if key not in seen:
                seen.add(key)
                cast.append({"name": person["name"]["full"], "character": key[1], "source_id": str(person["id"])})
    return TitleIn(source="anilist", source_id=str(data["id"]), media_type="anime",
        title=title.get("english") or title.get("romaji") or title.get("native"), synopsis=plain(data.get("description")),
        release_year=data.get("seasonYear"), rating=data["averageScore"] / 10 if data.get("averageScore") is not None else None,
        episode_count=data.get("episodes"), runtime_minutes=data.get("duration"), status=data.get("status"),
        age_rating="18+" if data.get("isAdult") else None,
        poster_url=(data.get("coverImage") or {}).get("extraLarge"), backdrop_url=data.get("bannerImage"),
        genres=data.get("genres") or [], cast=cast)


def safe_base_url(url):
    parsed = urlsplit(url)
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ImportFailure("Catalog URL must not include credentials, query or fragment")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ImportFailure("Catalog URL must use HTTP(S)")
    if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ImportFailure("Use HTTPS or a localhost SSH tunnel for authenticated remote catalog access")
    return url.rstrip("/")


def run(args):
    base = safe_base_url(args.base_url)
    token = os.getenv("CATALOG_WRITE_TOKEN", "")
    provider_token = os.getenv("TMDB_READ_TOKEN", "")
    if args.write and len(token) < 32:
        raise ImportFailure("Set CATALOG_WRITE_TOKEN (at least 32 characters) privately before --write")
    if args.provider == "tmdb" and not provider_token:
        raise ImportFailure("Set TMDB_READ_TOKEN privately; never paste it into source or commands")
    if args.provider == "anilist" and args.media != "anime":
        raise ImportFailure("AniList supports --media anime only; use TMDB for movies/series")
    if args.provider == "tmdb" and args.media == "anime":
        raise ImportFailure("Use --media movie or series with TMDB")
    headers = {"Authorization": f"Bearer {provider_token}"} if args.provider == "tmdb" else {}
    count = 0
    with httpx.Client(headers=headers, timeout=30, follow_redirects=False) as provider, httpx.Client(headers={"Authorization": f"Bearer {token}"}, timeout=60, follow_redirects=False) as catalog:
        for page in range(args.start_page, args.start_page + args.pages):
            print(f"Fetching provider page {page}", flush=True)
            if args.provider == "tmdb":
                kind = "movie" if args.media == "movie" else "tv"
                data = request_json(provider, "GET", f"{TMDB}/discover/{kind}", params={"page": page, "sort_by": "popularity.desc", "include_adult": "false"})
                listing = data.get("results", [])
                has_next = page < data.get("total_pages", page)
            else:
                data = request_json(provider, "POST", ANILIST, json={"query": ANILIST_QUERY, "variables": {"page": page, "perPage": min(args.batch_size, 50)}})
                if data.get("errors") or not data.get("data"):
                    raise ImportFailure("AniList returned GraphQL errors or missing data")
                page_data = data["data"]["Page"]
                listing, has_next = page_data["media"], page_data["pageInfo"]["hasNextPage"]
            batch = []
            for entry in listing:
                # Stop at a bounded count; rerun this same page if partially processed.
                if count >= args.max_items:
                    break
                item = tmdb_title(provider, entry, args.media, args.region, include_seasons=not args.skip_seasons) if args.provider == "tmdb" else anilist_title(entry)
                batch.append(item.model_dump(mode="json"))
                count += 1
                if len(batch) == args.batch_size:
                    submit(catalog, base, batch, args.write)
                    batch = []
                time.sleep(0.8 if args.provider == "anilist" else 0.25)
            if batch:
                submit(catalog, base, batch, args.write)
            print(f"Page {page}: {count} validated titles so far; {'written' if args.write else 'DRY RUN (no database writes)'}", flush=True)
            if count >= args.max_items:
                print(f"Item limit reached. To resume safely, reprocess --start-page {page}; identities are idempotent.")
                break
            if not has_next:
                break
    return count


def submit(client, base, batch, write):
    if write:
        result = request_json(client, "POST", f"{base}/api/titles/batch", json={"titles": batch})
        print(f"Batch: created={result['created']} updated={result['updated']}", flush=True)


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=["tmdb", "anilist"], required=True)
    parser.add_argument("--media", choices=["movie", "series", "anime"], required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--pages", type=int, default=1)
    parser.add_argument("--max-items", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--region", default="US", help="Two-letter age-certification country; default US")
    parser.add_argument("--skip-seasons", action="store_true", help="Metadata-only refresh; preserve stored season details")
    parser.add_argument("--write", action="store_true", help="Explicitly POST validated batches; otherwise dry-run")
    args = parser.parse_args()
    if not (1 <= args.start_page <= 500 and 1 <= args.pages <= 100 and args.start_page + args.pages <= 501 and 1 <= args.batch_size <= 100 and 1 <= args.max_items <= 10000):
        parser.error("Use pages 1..500, up to 100 pages, batch-size 1..100 and max-items 1..10000")
    args.region = args.region.upper()
    if len(args.region) != 2 or not args.region.isalpha() or not args.region.isascii():
        parser.error("--region must be a two-letter country code")
    try:
        run(args)
    except ImportFailure as error:
        print(f"Import stopped: {error}. Previously committed batches remain; reprocess the last fetching page.")
        raise SystemExit(1)
    except (ValueError, KeyError, TypeError):
        # Validation may include payload data; keep tokens/provider responses out of logs.
        print("Import stopped: upstream, configuration or validation failure. No current unsubmitted batch was written. Check credentials/schema privately; previously committed batches remain. Rerun the last reported page idempotently.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
