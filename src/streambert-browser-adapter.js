/**
 * Optional Streambert bridge. Browser calls remain disabled until a proxy exists;
 * Node calls load the CommonJS scraper only when one of these functions is used.
 */
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
let nodeModulePromise;

async function loadNodeScraper() {
  if (isBrowser) return null;
  nodeModulePromise ||= import('./streambert-anime-test.cjs').then(
    (module) => module.default || module,
  );
  return nodeModulePromise;
}

export async function hianimeSearch(query) {
  const scraper = await loadNodeScraper();
  return scraper ? scraper.hianimeSearch(query) : [];
}

export async function hianimeEpisodes(showId) {
  const scraper = await loadNodeScraper();
  return scraper ? scraper.hianimeEpisodes(showId) : [];
}

export async function hianimeStream(episodeId, mode = 'sub') {
  const scraper = await loadNodeScraper();
  return scraper ? scraper.hianimeStream(episodeId, mode) : null;
}
