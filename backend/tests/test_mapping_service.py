import unittest

from services.mapping_service import build_genre_endpoint_options, map_anime_to_db


class MappingServiceTests(unittest.TestCase):
    def test_maps_anilist_fields_and_status(self):
        anime = {
            "id": 123,
            "idMal": 456,
            "title": {"english": "Example", "romaji": "Rei"},
            "coverImage": {"extraLarge": "large.jpg", "medium": "medium.jpg"},
            "bannerImage": "banner.jpg",
            "genres": ["Action", "Drama"],
            "status": "RELEASING",
            "episodes": 12,
            "duration": 24,
            "averageScore": 91,
            "isAdult": False,
        }

        mapped = map_anime_to_db(anime)

        self.assertEqual(mapped["id"], "123")
        self.assertEqual(mapped["title"], "Example")
        self.assertEqual(mapped["status"], "Currently Airing")
        self.assertEqual(mapped["seasons"], "12 Episodes")
        self.assertEqual(mapped["matchPercentage"], "91%")
        self.assertEqual(mapped["poster"], "banner.jpg")
        self.assertIsNone(mapped["streamUrl"])

    def test_groups_only_by_primary_genre_and_handles_missing_genres(self):
        options = build_genre_endpoint_options([
            {"id": "1", "genres": ["Action", "Drama"]},
            {"id": "2", "genres": []},
        ])

        self.assertEqual([option["genre_name"] for option in options], ["Action", "Uncategorized"])
        self.assertNotIn("Drama", [option["genre_name"] for option in options])


if __name__ == "__main__":
    unittest.main()
