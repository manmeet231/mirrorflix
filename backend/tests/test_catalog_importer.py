import argparse
import os
import unittest
from unittest.mock import patch
import httpx
from catalog.importer import (ImportFailure, request_json, tmdb_title, anilist_title, run, safe_base_url)


class ImporterTests(unittest.TestCase):
    def test_tmdb_series_includes_season_episodes_cast_and_region_rating(self):
        requests = []
        def handler(request):
            requests.append(request.url.path)
            if '/season/' in request.url.path:
                return httpx.Response(200, json={"season_number": 1, "name": "Season 1", "overview": "Season synopsis", "episodes": [{"episode_number": 1, "name": "Pilot", "overview": "Episode synopsis", "air_date": "2026-01-01", "runtime": 24}]})
            return httpx.Response(200, json={"id": 7, "name": "Series", "overview": "Show synopsis", "first_air_date": "2026-01-01", "vote_average": 8.2, "vote_count": 100, "number_of_seasons": 1, "number_of_episodes": 1, "genres": [{"name": "Drama"}], "seasons": [{"season_number": 1}], "credits": {"cast": [{"id": 3, "name": "Actor", "character": "Lead"}]}, "content_ratings": {"results": [{"iso_3166_1": "US", "rating": "TV-14"}]}})
        with httpx.Client(transport=httpx.MockTransport(handler)) as client, patch('catalog.importer.time.sleep'):
            item = tmdb_title(client, {'id': 7}, 'series', 'US')
        self.assertEqual(item.seasons[0].episodes[0].synopsis, 'Episode synopsis')
        self.assertEqual(item.cast[0].name, 'Actor')
        self.assertEqual(item.age_rating, 'TV-14')
        self.assertEqual(len(requests), 2)

    def test_skip_seasons_and_missing_fields_remain_unknown(self):
        payload = {'id': 7, 'name': 'Series', 'seasons': [{'season_number': 1}], 'vote_count': 0, 'vote_average': 0}
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))) as client:
            item = tmdb_title(client, {'id': 7}, 'series', 'IN', include_seasons=False)
        self.assertIsNone(item.age_rating)
        self.assertIsNone(item.age_rating_region)
        self.assertIsNone(item.seasons)
        self.assertIsNone(item.rating)

    def test_movie_rating_is_not_mixed_with_age_certificate(self):
        payload = {'id': 7, 'title': 'Film', 'runtime': 100, 'vote_count': 2, 'vote_average': 7.1, 'release_dates': {'results': [{'iso_3166_1': 'US', 'release_dates': [{'certification': 'PG-13'}]}]}}
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))) as client:
            item = tmdb_title(client, {'id': 7}, 'movie', 'US')
        self.assertEqual(item.rating, 7.1)
        self.assertEqual(item.age_rating, 'PG-13')
        self.assertIsNone(item.episode_count)

    def test_anilist_does_not_fabricate_seasons_episode_synopses_or_age_rating(self):
        item = anilist_title({'id': 1, 'title': {'romaji': 'Anime'}, 'description': '<b>A story</b> &amp; more', 'episodes': 12, 'averageScore': 80})
        self.assertEqual(item.synopsis, 'A story & more')
        self.assertEqual(item.episode_count, 12)
        self.assertIsNone(item.seasons)
        self.assertIsNone(item.age_rating)
        self.assertEqual(item.rating, 8)

    def test_transient_retries_and_auth_failures_are_not_retried(self):
        replies = [httpx.Response(429, headers={'Retry-After': '0'}), httpx.Response(503), httpx.Response(200, json={'ok': True})]
        with httpx.Client(transport=httpx.MockTransport(lambda r: replies.pop(0))) as client, patch('catalog.importer.time.sleep') as wait:
            self.assertEqual(request_json(client, 'GET', 'https://example.test'), {'ok': True})
            self.assertEqual(wait.call_count, 2)
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(401))) as client, patch('catalog.importer.time.sleep') as wait:
            with self.assertRaises(ImportFailure):
                request_json(client, 'GET', 'https://example.test')
            wait.assert_not_called()

    def test_exhausted_retries_and_graphql_errors_stop_import(self):
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as client, patch('catalog.importer.time.sleep'):
            with self.assertRaises(ImportFailure):
                request_json(client, 'POST', 'https://example.test')

    def test_remote_plaintext_and_embedded_secrets_are_rejected(self):
        for url in ['http://remote.example', 'https://user:password@example.test', 'https://example.test?token=secret']:
            with self.subTest(url=url), self.assertRaises(ImportFailure):
                safe_base_url(url)
        self.assertEqual(safe_base_url('http://127.0.0.1:8001/'), 'http://127.0.0.1:8001')

    def test_dry_run_does_not_write_and_write_sends_bounded_batches(self):
        real_client = httpx.Client
        posts = []
        catalog_authorizations = []
        def handler(request):
            if request.url.host == 'graphql.anilist.co':
                # Catalog token must not be sent to the metadata provider.
                self.assertNotIn('Authorization', request.headers)
                return httpx.Response(200, json={'data': {'Page': {'pageInfo': {'hasNextPage': False}, 'media': [{'id': n, 'title': {'romaji': f'Anime {n}'}} for n in [1,2,3]]}}})
            posts.append(__import__('json').loads(request.content))
            catalog_authorizations.append(request.headers['Authorization'])
            return httpx.Response(200, json={'created': len(posts[-1]['titles']), 'updated': 0})
        args = argparse.Namespace(provider='anilist', media='anime', base_url='http://127.0.0.1:8001', start_page=1, pages=1, max_items=3, batch_size=2, region='US', skip_seasons=False, write=False)
        def client_factory(**kwargs):
            return real_client(transport=httpx.MockTransport(handler), **kwargs)
        with patch('catalog.importer.httpx.Client', side_effect=client_factory), patch('catalog.importer.time.sleep'), patch.dict(os.environ, {'CATALOG_WRITE_TOKEN': 'x'*32}):
            self.assertEqual(run(args), 3)
            self.assertEqual(posts, [])
            args.write = True
            self.assertEqual(run(args), 3)
        self.assertEqual([len(p['titles']) for p in posts], [2,1])
        self.assertEqual(catalog_authorizations, ['Bearer '+'x'*32]*2)
