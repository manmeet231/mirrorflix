/**
 * Node.js Integration Test
 * Tests the integration in a Node.js environment
 */

import { fetchAniListAnime, categorizeAnime } from './components/anilistService.js';
import { getCategorizedAnime } from './components/animeDataService.js';

async function runNodeTest() {
  console.log('🚀 Starting Node.js Integration Test...\n');
  
  try {
    // Test 1: AniList API
    console.log('📡 Testing AniList API...');
    const anilistData = await fetchAniListAnime({ perPage: 3 });
    console.log(`✅ Successfully fetched ${anilistData.Page.media.length} anime`);
    
    // Test 2: Categorization
    console.log('\n🏷️ Testing categorization...');
    const categories = categorizeAnime(anilistData.Page.media);
    console.log('✅ Categories created successfully');
    
    // Test 3: Full integration
    console.log('\n🔄 Testing full integration...');
    const animeData = await getCategorizedAnime({ perPage: 3 });
    console.log(`✅ Successfully processed ${animeData.anime.length} anime`);
    
    // Display results
    console.log('\n📊 Results:');
    console.log(`Total anime: ${animeData.anime.length}`);
    console.log(`Categories: ${Object.keys(animeData.categories).length}`);
    
    console.log('\n📋 Categories:');
    Object.keys(animeData.categories).forEach(category => {
      if (Array.isArray(animeData.categories[category])) {
        console.log(`  ${category}: ${animeData.categories[category].length} anime`);
      } else {
        console.log(`  ${category}: ${Object.keys(animeData.categories[category]).length} subcategories`);
      }
    });
    
    // Show first anime
    if (animeData.anime.length > 0) {
      const firstAnime = animeData.anime[0];
      console.log('\n📺 First anime:');
      console.log(`  Title: ${firstAnime.title}`);
      console.log(`  Genres: ${firstAnime.genres?.join(', ') || 'N/A'}`);
      console.log(`  Status: ${firstAnime.status || 'N/A'}`);
      console.log(`  Has stream URL: ${firstAnime.streamUrl ? 'Yes' : 'No'}`);
    }
    
    console.log('\n🎉 Node.js integration test completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Node.js integration test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
runNodeTest();