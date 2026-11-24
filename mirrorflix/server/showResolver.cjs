function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function extractSeason(value) {
  const title = normalizeTitle(value);
  const match = title.match(/\bseason\s+(\d+)\b/)
    || title.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/)
    || title.match(/\bs\s*(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function stripSeason(value) {
  return normalizeTitle(value)
    .replace(/\bseason\s+\d+\b/g, "")
    .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/g, "")
    .replace(/\bs\s*\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function selectShow(results, title, alternativeTitles = []) {
  const wanted = new Set(
    [title, ...alternativeTitles].map(normalizeTitle).filter(Boolean),
  );
  return results.find((result) =>
    [result.title, result.jname].some((name) => wanted.has(normalizeTitle(name)))
  ) || results[0];
}

function candidateDetails(result, wanted, requestedSeason, requestedBase, index) {
  const names = [result.title, result.jname].map(normalizeTitle).filter(Boolean);
  const exact = names.some((name) => wanted.has(name));
  const season = extractSeason(names[0]) ?? extractSeason(names[1]);
  const baseMatches = requestedBase && names.some((name) => stripSeason(name) === requestedBase);
  const special = /\b(specials?|recap|commemorative|road to hero|ova|ona|movie)\b/.test(names[0]);
  const requestedSpecial = [...wanted].some((name) =>
    /\b(specials?|recap|commemorative|road to hero|ova|ona|movie)\b/.test(name)
  );

  if (requestedSeason && season && season !== requestedSeason) return null;
  if (requestedSeason && !season && !exact && !baseMatches) return null;

  let score = exact ? 10000 : 0;
  if (requestedSeason && baseMatches) score += 2000;
  if (requestedSeason && season === requestedSeason) score += 1500;
  if (requestedSeason === 1 && !season && baseMatches) score += 1400;
  if (!requestedSeason && season) score -= 100;
  if (special && !requestedSpecial) score -= 500;

  return { result, index, score, episodes: [] };
}

async function resolveShowEpisodes(
  results,
  { title, alternativeTitles = [], expectedEpisodes = null },
  loadEpisodes,
) {
  const uniqueResults = [...new Map(results.map((result) => [result.id, result])).values()];
  const wanted = new Set(
    [title, ...alternativeTitles].map(normalizeTitle).filter(Boolean),
  );
  const requestedSeason = extractSeason(title);
  const requestedBase = requestedSeason ? stripSeason(title) : null;
  const candidates = uniqueResults
    .map((result, index) => candidateDetails(
      result,
      wanted,
      requestedSeason,
      requestedBase,
      index,
    ))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 6);

  if (!candidates.length) {
    return { show: uniqueResults[0], episodes: [] };
  }

  await Promise.all(candidates.map(async (candidate) => {
    try {
      candidate.episodes = await loadEpisodes(candidate.result.id);
    } catch {
      candidate.episodes = [];
    }
  }));

  for (const candidate of candidates) {
    const count = candidate.episodes.length;
    if (count > 0) candidate.score += 500;
    if (expectedEpisodes > 0) {
      const difference = Math.abs(count - expectedEpisodes);
      if (difference === 0) candidate.score += 4000;
      else candidate.score += Math.max(0, 1000 - difference * 50);
    } else {
      candidate.score += Math.min(count * 20, 1000);
    }
    candidate.score += Math.min(count, 100);
  }

  candidates.sort((left, right) =>
    right.score - left.score
    || right.episodes.length - left.episodes.length
    || left.index - right.index
  );
  const best = candidates[0];
  return { show: best.result, episodes: best.episodes };
}

module.exports = {
  extractSeason,
  normalizeTitle,
  resolveShowEpisodes,
  selectShow,
  stripSeason,
};
