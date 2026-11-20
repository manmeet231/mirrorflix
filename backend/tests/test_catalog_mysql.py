"""Optional integration checks: explicitly supplied, disposable local MySQL only."""
import os
import unittest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url
from catalog.database import make_engine
from catalog.models import Base
from catalog.api import create_app

URL = os.getenv('CATALOG_TEST_MYSQL_URL')
TOKEN = 'review-test-' + 'x' * 32


@unittest.skipUnless(URL, 'CATALOG_TEST_MYSQL_URL not supplied (no production fallback)')
class MySQLCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        target = make_url(URL)
        if target.drivername != 'mysql+pymysql' or target.host not in {'127.0.0.1', 'localhost', '::1'} or not (target.database or '').startswith('codex_test_'):
            raise RuntimeError('Integration tests require disposable loopback MySQL database named codex_test_*')
        cls.engine = make_engine(URL)
        Base.metadata.create_all(cls.engine)
        cls.context = TestClient(create_app(cls.engine, TOKEN))
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)

    def test_collation_equivalent_genre_names_remain_idempotent(self):
        identity = uuid.uuid4().hex
        name = f'ReviewDrama-{identity}'
        item = {'source': 'manual', 'source_id': identity, 'media_type': 'movie', 'title': 'Review movie', 'genres': [name]}
        headers = {'Authorization': f'Bearer {TOKEN}'}
        first = self.client.post('/api/titles/batch', json={'titles': [item]}, headers=headers)
        self.assertEqual(first.status_code, 200, first.text)
        title_id = first.json()['ids'][0]
        item['genres'] = [name.lower(), name.upper()]
        repeat = self.client.post('/api/titles/batch', json={'titles': [item]}, headers=headers)
        self.assertEqual(repeat.status_code, 200, repeat.text)
        self.assertEqual(len(self.client.get(f'/api/titles/{title_id}').json()['genres']), 1)
