/**
 * Integration Test Script
 * Tests the integration between AniList and Streambert services
 */

import { fetchAniListAnime, categorizeAnime } from './components/anilistService.js';
import { getCategorizedAnime } from './components/animeDataService.js';
import { hianimeSearch, hianimeEpisodes } from './streambert-browser-adapter.js';

async function testAniListIntegration() {
  console.log('🧪 Testing AniList Integration...');
  
  try {
    // Test fetching anime from AniList
    console.log('\n📡 Testing AniList API...');
    const anilistData = await fetchAniListAnime({ perPage: 5 });
    
    console.log(`✅ Successfully fetched ${anilistData.Page.media.length} anime from AniList`);
    console.log(`📊 Total pages: ${anilistData.Page.pageInfo.lastPage}`);
    
    // Test categorization
    console.log('\n🏷️ Testing categorization...');
    const categories = categorizeAnime(anilistData.Page.media);
    
    console.log('📋 Categories created:');
    Object.keys(categories).forEach(category => {
      if (Array.isArray(categories[category])) {
        console.log(`  ${category}: ${categories[category].length} anime`);
      } else {
        console.log(`  ${category}: ${Object.keys(categories[category]).length} subcategories`);
        Object.keys(categories[category]).forEach(subcategory => {
          console.log(`    ${subcategory}: ${categories[category][subcategory].length} anime`);
        });
      }
    });
    
    return anilistData;
  } catch (error) {
    console.error('❌ AniList integration test failed:', error.message);
    throw error;
  }
}

async function testStreambertIntegration() {
  console.log('\n🧪 Testing Streambert Integration...');
  
  try {
    // Test searching for anime
    console.log('\n🔍 Testing anime search...');
    const searchResults = await hianimeSearch('Mob Psycho 100');
    console.log(`✅ Found ${searchResults.length} results for "Mob Psycho 100"`);
    
    if (searchResults.length > 0) {
      const show = searchResults[0];
      console.log(`📺 Selected: ${show.title} (${show.id})`);
      
      // Test getting episodes
      console.log('\n📋 Testing episode fetching...');
      const episodes = await hianimeEpisodes(show.id);
      console.log(`✅ Found ${episodes.length} episodes for ${show.title}`);
      
      if (episodes.length > 0) {
        // Test getting stream URL
        console.log('\n🌐 Testing stream URL resolution...');
        const stream = await hianimeStream(episodes[0].epId, 'sub');
        console.log('✅ Stream URL resolved successfully');
        console.log(`   URL: ${stream.masterUrl.substring(0, 50)}...`);
      }
    }
    
    return searchResults;
  } catch (error) {
    console.error('❌ Streambert integration test failed:', error.message);
    throw error;
  }
}

async function testFullIntegration() {
  console.log('\n🧪 Testing Full Integration...');
  
  try {
    console.log('\n🔄 Testing combined AniList + Streambert service...');
    const animeData = await getCategorizedAnime({ perPage: 3 }, { episodeNumber: 1, mode: 'sub' });
    
    console.log(`✅ Successfully processed ${animeData.anime.length} anime`);
    console.log('📊 Categories available:');
    Object.keys(animeData.categories).forEach(category => {
      if (Array.isArray(animeData.categories[category])) {
        console.log(`  ${category}: ${animeData.categories[category].length} anime`);
      } else {
        console.log(`  ${category}: ${Object.keys(animeData.categories[category]).length} subcategories`);
      }
    });
    
    // Display first anime as example
    if (animeData.anime.length > 0) {
      const firstAnime = animeData.anime[0];
      console.log('\n📺 First anime in list:');
      console.log(`  Title: ${firstAnime.title}`);
      console.log(`  Genres: ${firstAnime.genres.join(', ')}`);
      console.log(`  Status: ${firstAnime.status}`);
      console.log(`  Has stream URL: ${firstAnime.streamUrl ? 'Yes' : 'No'}`);
    }
    
    return animeData;
  } catch (error) {
    console.error('❌ Full integration test failed:', error.message);
    throw error;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Integration Tests...\n');
  
  try {
    // Test individual services
    await testAniListIntegration();
    await testStreambertIntegration();
    
    // Test full integration
    await testFullIntegration();
    
    console.log('\n🎉 All integration tests passed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ AniList API integration working');
    console.log('✅ Streambert integration working');
    console.log('✅ Combined service working');
    console.log('✅ Categorization working');
    
  } catch (error) {
    console.error('\n💥 Integration tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testAniListIntegration, testStreambertIntegration, testFullIntegration };