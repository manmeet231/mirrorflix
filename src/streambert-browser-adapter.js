/**
 * Streambert Browser Adapter
 * Provides browser-compatible versions of Streambert functions
 */

// This module is used by the browser app. Keep the Node/Electron test runner
// out of the browser dependency graph; its Node built-ins cannot be bundled by
// Vite and stream resolution is not implemented as a public browser API.
async function browserHianimeSearch(query) {
  // In a real implementation, this would make API calls to a proxy server
  // For now, return mock data
  console.log('Browser search not implemented yet');
  return [];
}

async function browserHianimeEpisodes(showId) {
  // In a real implementation, this would make API calls to a proxy server
  console.log('Browser episodes not implemented yet');
  return [];
}

async function browserHianimeStream(epId, mode) {
  // In a real implementation, this would make API calls to a proxy server
  console.log('Browser stream not implemented yet');
  return null;
}

export const hianimeSearch = browserHianimeSearch;
export const hianimeEpisodes = browserHianimeEpisodes;
export const hianimeStream = browserHianimeStream;
