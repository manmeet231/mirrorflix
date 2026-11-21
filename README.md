# MirrorFlix - Anime Streaming Platform

A modern anime streaming platform that integrates AniList data with Streambert's anime scraping capabilities to provide categorized anime content.

## Features

- **AniList Integration**: Fetch anime data from AniList API
- **Streambert Integration**: Get detailed episode information and stream URLs
- **Categorized Content**: Browse anime by status, genres, seasons, and years
- **Responsive UI**: Modern React-based interface with MovieCard and MovieRow components
- **Video Player**: Local video player with HLS support

## Architecture

### Components

1. **AniList Service** (`src/components/anilistService.js`)
   - Handles fetching anime data from AniList API
   - Provides GraphQL queries for anime information
   - Categorizes anime by various attributes

2. **Anime Data Service** (`src/components/animeDataService.js`)
   - Integrates AniList data with Streambert functionality
   - Maps anime data to the format expected by MovieCard components
   - Fetches stream data from Streambert for each anime

3. **Categorized Anime Section** (`src/components/CategorizedAnimeSection.jsx`)
   - Displays anime in categorized tabs
   - Supports multiple categorization methods
   - Handles loading states and errors

4. **Streambert Anime Test** (`src/streambert-anime-test.js`)
   - Provides anime scraping functionality
   - Searches for anime on HiAnime
   - Gets episode lists and stream URLs
   - Includes a local video player server

## Data Flow

1. **Fetch Anime Data**: The app fetches anime from AniList API
2. **Get Stream Information**: For each anime, it uses Streambert to get detailed episode and stream data
3. **Categorize**: Anime are categorized by status, genres, seasons, and years
4. **Display**: The categorized anime are displayed using MovieRow and MovieCard components

## Categories

- **Currently Airing**: Anime that are currently being released
- **Upcoming**: Anime that are scheduled for release
- **Completed**: Finished anime series
- **Genres**: Action, Comedy, Drama, etc.
- **Seasons**: Winter, Spring, Summer, Fall anime by year
- **Years**: Anime grouped by their release year

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

### Browsing Anime

1. The app automatically fetches anime data from AniList when loaded
2. Use the category tabs to browse anime by different criteria
3. Click on any anime card to view details in the modal

### Stream Data

- The app attempts to fetch stream URLs from Streambert for each anime
- If stream data is available, it will be included in the anime details
- The local video player can be used for playback

### Development

#### Adding New Categories

1. Update the `categorizeAnime` function in `anilistService.js`
2. Add the new category to the UI in `CategorizedAnimeSection.jsx`

#### Customizing Streambert Integration

1. Modify the `getStreamData` function in `animeDataService.js`
2. Update the stream fetching options as needed

## Configuration

### AniList API

The app uses the AniList GraphQL API. No additional configuration is required as the API is public.

### Streambert

Streambert configuration is handled in `streambert-anime-test.js`:
- `BASE_URL`: The base URL for HiAnime
- `SERVER_NAME`: The server name for stream resolution
- `USER_AGENT`: The user agent for HTTP requests

## Troubleshooting

### Common Issues

1. **Anime not loading**: Check your internet connection and AniList API availability
2. **Stream data not available**: Some anime may not have stream URLs available
3. **Player not working**: Ensure HLS.js is properly installed and loaded

### Error Handling

The app includes error handling for:
- API failures
- Network issues
- Missing data
- Stream resolution errors

## Future Enhancements

- [ ] User authentication and watchlists
- [ ] Search functionality
- [ ] Advanced filtering options
- [ ] Dark/light theme toggle
- [ ] Mobile app optimization
- [ ] Support for additional streaming sources

## License

This project is licensed under the ISC License.