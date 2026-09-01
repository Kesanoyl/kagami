/**
 * Hits the real AniList endpoint with the exact documents the app sends.
 * Run with `node scripts/smoke-api.mjs` after touching services/api/queries.ts.
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/api/queries.ts', import.meta.url), 'utf8');

/** Pulls an exported template literal out of the queries module. */
function extract(name) {
  const match = source.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`));
  if (!match) throw new Error(`Requête ${name} introuvable`);
  return match[1];
}

const MEDIA_FIELDS = extract('MEDIA_FIELDS');
const inline = (query) => query.replace('${MEDIA_FIELDS}', MEDIA_FIELDS).replaceAll('${MEDIA_FIELDS}', MEDIA_FIELDS);

async function run(label, query, variables) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: inline(query), variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(`✗ ${label}:`, JSON.stringify(json.errors));
    process.exitCode = 1;
    return null;
  }
  console.log(`✓ ${label} (HTTP ${res.status})`);
  return json.data;
}

const season = (() => {
  const m = new Date().getMonth();
  return m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL';
})();

const search = await run('SEARCH_QUERY', extract('SEARCH_QUERY'), {
  q: 'one piece',
  page: 1,
  perPage: 3,
  isAdult: false,
});
if (search) {
  const first = search.Page.media[0];
  console.log(`   → ${first.title.romaji} · ${first.episodes ?? '?'} ép. · score ${first.averageScore}`);
}

await run('BROWSE_QUERY (trending)', extract('BROWSE_QUERY'), {
  page: 1,
  perPage: 3,
  sort: ['TRENDING_DESC'],
  isAdult: false,
});

const seasonal = await run('BROWSE_QUERY (saison)', extract('BROWSE_QUERY'), {
  page: 1,
  perPage: 3,
  sort: ['POPULARITY_DESC'],
  season,
  seasonYear: new Date().getFullYear(),
  isAdult: false,
});
if (seasonal) console.log(`   → ${seasonal.Page.media.length} titres pour ${season} ${new Date().getFullYear()}`);

const airing = await run('BROWSE_QUERY (en diffusion)', extract('BROWSE_QUERY'), {
  page: 1,
  perPage: 5,
  sort: ['TRENDING_DESC'],
  status: 'RELEASING',
  isAdult: false,
});
if (airing) {
  const withSchedule = airing.Page.media.filter((m) => m.nextAiringEpisode);
  console.log(`   → ${withSchedule.length}/${airing.Page.media.length} avec nextAiringEpisode (calendrier)`);
}

await run('BROWSE_QUERY (genre)', extract('BROWSE_QUERY'), {
  page: 1,
  perPage: 3,
  sort: ['POPULARITY_DESC'],
  genre: 'Action',
  isAdult: false,
});

await run('BY_IDS_QUERY', extract('BY_IDS_QUERY'), { ids: [21, 16498, 113415], perPage: 3 });

const detail = await run('DETAIL_QUERY', extract('DETAIL_QUERY'), { id: 113415 });
if (detail) {
  console.log(
    `   → ${detail.Media.title.romaji} · ${detail.Media.recommendations.nodes.length} recos · ${detail.Media.relations.edges.length} relations`,
  );
}

await run('RECOMMENDATIONS_QUERY', extract('RECOMMENDATIONS_QUERY'), { id: 21 });

const nowSec = Math.floor(Date.now() / 1000);

const worldwide = await run('RECENT_AIRINGS_QUERY (monde)', extract('RECENT_AIRINGS_QUERY'), {
  from: nowSec - 72 * 3600,
  to: nowSec,
  perPage: 5,
});
if (worldwide) {
  const slots = worldwide.Page.airingSchedules;
  console.log(`   → ${slots.length} épisodes sortis sur 72 h`);
  if (slots[0]) console.log(`   → ${slots[0].media.title.romaji} ép.${slots[0].episode}`);
}

const mine = await run('RECENT_AIRINGS_QUERY (mes séries)', extract('RECENT_AIRINGS_QUERY'), {
  ids: [21, 113415],
  from: nowSec - 30 * 86400,
  to: nowSec,
  perPage: 10,
});
if (mine) console.log(`   → ${mine.Page.airingSchedules.length} épisodes pour 2 séries suivies`);

// A public profile, so the import path is exercised end to end.
const list = await run('USER_LIST_QUERY', extract('USER_LIST_QUERY'), { name: 'Migoto' });
if (list) {
  const entries = list.MediaListCollection.lists.flatMap((l) => l.entries);
  console.log(`   → ${entries.length} entrées importables pour « Migoto »`);
}

console.log(process.exitCode ? '\nDes requêtes ont échoué.' : '\nToutes les requêtes passent.');
