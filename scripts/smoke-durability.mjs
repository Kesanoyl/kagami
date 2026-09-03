/**
 * Tries to destroy the watchlist, four different ways, in a real browser.
 * Every scenario must end with the data still recoverable.
 *
 * Prerequisite: npm run build && npx vite preview --port 4173
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const PORT = 9488;
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const profile = mkdtempSync(join(tmpdir(), 'kagami-dur-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch { /* wait */ }
  await sleep(250);
}

const target = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => socket.addEventListener('open', r, { once: true }));

let id = 1;
const waiting = new Map();
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    const { resolve, reject } = waiting.get(m.id);
    waiting.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = id++;
    waiting.set(n, { resolve, reject });
    socket.send(JSON.stringify({ id: n, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval');
  return r.result.value;
};
const goto = async (path) => {
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(2600);
};

const iso = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const anime = (idNum, title) => ({
  id: idNum, malId: null, title, titleEnglish: null, titleNative: null, poster: null,
  banner: null, color: null, synopsis: 'x', genres: ['Action'], episodes: 24, duration: 24,
  year: 2024, season: null, format: 'TV', airingStatus: 'FINISHED', averageScore: 80,
  popularity: 1000, studio: null, source: null, startDate: null, endDate: null,
  nextEpisode: null, siteUrl: null, isAdult: false, cachedAt: Date.now(),
});
const entry = (idNum, episode) => ({
  animeId: idNum, status: 'watching', currentEpisode: episode, currentSeason: null,
  currentPart: null, currentArc: null, rating: 8, notes: 'precieux', notesUpdatedAt: iso(1),
  favorite: false, rewatches: 0, addedAt: iso(30), updatedAt: iso(1), startedAt: iso(30),
  completedAt: null, history: [],
});

const ANIMES = [anime(101, 'Serie A'), anime(102, 'Serie B'), anime(103, 'Serie C')];
const ENTRIES = [entry(101, 5), entry(102, 10), entry(103, 15)];

const results = [];
let failed = false;
const report = (ok, label, detail = '') => {
  if (!ok) failed = true;
  results.push(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `\n       ${detail}` : ''}`);
};

const seed = async (entries = ENTRIES) => {
  await goto('/');
  await evaluate(`
    localStorage.clear();
    localStorage.setItem('kagami:v1:entries', ${JSON.stringify(JSON.stringify(entries))});
    localStorage.setItem('kagami:v1:animes', ${JSON.stringify(JSON.stringify(ANIMES))});
    true;
  `);
};

const storedCount = () =>
  evaluate(`JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]').length`);

// ---------------------------------------------------------------------------
// 1. Données illisibles : l'app ne doit pas démarrer vide PUIS écraser.
// ---------------------------------------------------------------------------
await seed();
await evaluate(`localStorage.setItem('kagami:v1:entries', '{ceci nest pas du json'); true;`);
await goto('/library');
await sleep(1500);
const quarantine = await evaluate(`
  (() => ({
    quarantined: localStorage.getItem('kagami:v1:entries.corrupt'),
    live: localStorage.getItem('kagami:v1:entries'),
  }))()
`);
report(
  typeof quarantine.quarantined === 'string' && quarantine.quarantined.includes('ceci nest pas'),
  'données illisibles : le texte brut est mis de côté, pas perdu',
  `quarantaine = ${String(quarantine.quarantined).slice(0, 40)}`,
);

// ---------------------------------------------------------------------------
// 2. Clé de stockage changée : les données orphelines sont récupérées.
// ---------------------------------------------------------------------------
await goto('/');
await evaluate(`
  localStorage.clear();
  localStorage.setItem('kagami:v9:entries', ${JSON.stringify(JSON.stringify(ENTRIES))});
  localStorage.setItem('kagami:v1:animes', ${JSON.stringify(JSON.stringify(ANIMES))});
  true;
`);
await goto('/library');
await sleep(1800);
const recovered = await storedCount();
report(recovered === 3, 'clé de stockage changée : les 3 séries sont récupérées', `trouvées : ${recovered}`);

// ---------------------------------------------------------------------------
// 3. Deux onglets : celui qui enregistre en dernier ne doit rien écraser.
// ---------------------------------------------------------------------------
await seed();
await goto('/library');
await sleep(1200);
// Simule l'autre onglet : il ajoute une 4e série et retire la 1re.
await evaluate(`
  (() => {
    const autre = ${JSON.stringify(JSON.stringify([...ENTRIES.slice(1), { ...entry(104, 2), animeId: 104 }]))};
    localStorage.setItem('kagami:v1:entries', autre);
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'kagami:v1:entries',
      newValue: autre,
      storageArea: localStorage,
    }));
    return true;
  })()
`);
await sleep(1500);
const merged = await evaluate(`
  (() => {
    const ids = JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]').map((e) => e.animeId);
    return { ids: ids.sort((a, b) => a - b), count: ids.length };
  })()
`);
report(
  merged.count === 4 && merged.ids.includes(101) && merged.ids.includes(104),
  'deux onglets : les deux listes fusionnent au lieu de s’écraser',
  `ids = ${JSON.stringify(merged.ids)}`,
);

// ---------------------------------------------------------------------------
// 4. Toute écriture qui réduit la liste laisse un point de restauration.
// ---------------------------------------------------------------------------
await seed();
await goto('/library');
await sleep(1200);
await evaluate(`localStorage.removeItem('kagami:v1:snapshots'); true;`);
// Retire une série via l'UI : le filet de sécurité doit se déclencher.
await evaluate(`
  (() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Noter et annoter'));
    if (b) b.click();
    return true;
  })()
`);
await sleep(700);
await evaluate(`
  (() => {
    const dialog = document.querySelector('[role="dialog"]');
    const b = [...(dialog?.querySelectorAll('button') ?? [])]
      .find((x) => x.textContent.includes('Retirer de ma liste'));
    if (b) b.click();
    return true;
  })()
`);
await sleep(1500);
const afterRemoval = await evaluate(`
  (() => ({
    entries: JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]').length,
    snapshots: JSON.parse(localStorage.getItem('kagami:v1:snapshots') ?? '[]')
      .map((s) => s.entryCount),
  }))()
`);
report(
  afterRemoval.entries === 2 && afterRemoval.snapshots.includes(3),
  'suppression d’une série : un point de restauration à 3 est créé',
  JSON.stringify(afterRemoval),
);

console.log(results.join('\n'));
console.log(
  failed ? '\nDes protections ont échoué.' : '\nToutes les protections tiennent.',
);

socket.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* tmp */ }
process.exit(failed ? 1 : 0);
