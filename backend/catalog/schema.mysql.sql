-- Review-only additive MySQL 8 DDL. Prefer python -m catalog.init_db after backup.
-- No DROP/ALTER statements. Database name and credentials are intentionally omitted.


CREATE TABLE IF NOT EXISTS catalog_genres (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(100) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
)

;

CREATE TABLE IF NOT EXISTS catalog_titles (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	source VARCHAR(32) NOT NULL, 
	source_id VARCHAR(100) NOT NULL, 
	media_type VARCHAR(10) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	synopsis MEDIUMTEXT, 
	release_year INTEGER, 
	rating FLOAT, 
	rating_count INTEGER, 
	age_rating VARCHAR(50), 
	age_rating_region VARCHAR(2), 
	season_count INTEGER, 
	episode_count INTEGER, 
	runtime_minutes INTEGER, 
	status VARCHAR(80), 
	poster_url TEXT, 
	backdrop_url TEXT, 
	cast JSON NOT NULL, 
	legacy JSON, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_catalog_source UNIQUE (source, media_type, source_id)
)CHARSET=utf8mb4

;
CREATE INDEX ix_catalog_title ON catalog_titles (title);

CREATE TABLE IF NOT EXISTS catalog_seasons (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	title_id INTEGER NOT NULL, 
	number INTEGER NOT NULL, 
	name VARCHAR(255), 
	synopsis MEDIUMTEXT, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_catalog_season UNIQUE (title_id, number), 
	FOREIGN KEY(title_id) REFERENCES catalog_titles (id)
)

;

CREATE TABLE IF NOT EXISTS catalog_title_genres (
	title_id INTEGER NOT NULL, 
	genre_id INTEGER NOT NULL, 
	PRIMARY KEY (title_id, genre_id), 
	FOREIGN KEY(title_id) REFERENCES catalog_titles (id), 
	FOREIGN KEY(genre_id) REFERENCES catalog_genres (id)
)

;

CREATE TABLE IF NOT EXISTS catalog_episodes (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	season_id INTEGER NOT NULL, 
	number INTEGER NOT NULL, 
	name VARCHAR(255), 
	synopsis MEDIUMTEXT, 
	runtime_minutes INTEGER, 
	air_date DATE, 
	thumbnail_url TEXT, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_catalog_episode UNIQUE (season_id, number), 
	FOREIGN KEY(season_id) REFERENCES catalog_seasons (id)
)

;
