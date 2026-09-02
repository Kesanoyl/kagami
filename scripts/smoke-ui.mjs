/**
 * Drives a real headless Chrome over the DevTools Protocol against the built
 * app, with a pre-seeded library, and fails on any console error or exception.
 *
 * Prerequisite: `npm run build && npx vite preview --port 4173`
 * Usage: node scripts/smoke-ui.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const PORT = 9333;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) throw new Error('Aucun navigateur Chromium trouve.');

const profile = mkdtempSync(join(tmpdir(), 'kagami-smoke-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('DevTools ne repond pas.');
}

await waitForDevTools();

const target = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const waiting = new Map();
const listeners = [];

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else if (message.method) {
    listeners.forEach((fn) => fn(message));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

/** Console errors and uncaught exceptions, reset per route. */
let problems = [];
listeners.push((message) => {
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    const args = message.params.args
      .map((a) => a.value ?? a.description ?? a.type)
      .join(' ');
    problems.push(`console.error: ${args}`);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    problems.push(`exception: ${details.exception?.description ?? details.text}`);
  }
});

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation echouee');
  }
  return result.result.value;
}

async function goto(path) {
  problems = [];
  await send('Page.navigate', { url: `${BASE}${path}` });
  await new Promise((resolve) => {
    listeners.push((message) => {
      if (message.method === 'Page.loadEventFired') resolve();
    });
    setTimeout(resolve, 8000);
  });
}

/**
 * Polls until every needle is present, so sections that depend on a network
 * round-trip get a fair chance before we call them missing.
 */
async function waitForText(needles, timeout = 15_000) {
  const wanted = Array.isArray(needles) ? needles : [needles];
  const deadline = Date.now() + timeout;
  let text = '';
  while (Date.now() < deadline) {
    text = await evaluate('document.body.innerText');
    if (wanted.every((needle) => text.includes(needle))) return text;
    await sleep(300);
  }
  return text;
}

// ---------------------------------------------------------------- seed data
const now = Math.floor(Date.now() / 1000);
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const seedAnimes = [
  {
    id: 21,
    malId: 21,
    title: 'ONE PIECE',
    titleEnglish: 'ONE PIECE',
    titleNative: 'ONE PIECE',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-tXMN3Y20PIL9.jpg',
    banner: null,
    color: '#e4a15d',
    synopsis: 'Gol D. Roger, le roi des pirates...',
    genres: ['Action', 'Adventure', 'Comedy'],
    episodes: 1150,
    duration: 24,
    year: 1999,
    season: 'FALL',
    format: 'TV',
    airingStatus: 'RELEASING',
    averageScore: 88,
    popularity: 500000,
    studio: 'Toei Animation',
    source: 'MANGA',
    startDate: '1999-10-20',
    endDate: null,
    nextEpisode: { episode: 1121, airingAt: now + 3 * 86400 },
    siteUrl: 'https://anilist.co/anime/21',
    cachedAt: Date.now(),
  },
  {
    id: 113415,
    malId: 40748,
    title: 'Jujutsu Kaisen',
    titleEnglish: 'JUJUTSU KAISEN',
    titleNative: 'JUJUTSU KAISEN',
    poster:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg',
    banner: null,
    color: '#e4c9a1',
    synopsis: 'Yuji Itadori avale un doigt maudit...',
    genres: ['Action', 'Supernatural', 'Drama'],
    episodes: 24,
    duration: 24,
    year: 2020,
    season: 'FALL',
    format: 'TV',
    airingStatus: 'FINISHED',
    averageScore: 86,
    popularity: 400000,
    studio: 'MAPPA',
    source: 'MANGA',
    startDate: '2020-10-03',
    endDate: '2021-03-27',
    nextEpisode: null,
    siteUrl: 'https://anilist.co/anime/113415',
    cachedAt: Date.now(),
  },
];

// A deliberately long romaji title with a native title and a banner: the exact
// combination that made the Japanese watermark collide with the <h1>.
seedAnimes.push({
  id: 999001,
  malId: null,
  title: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
  titleEnglish: 'Re:ZERO -Starting Life in Another World- Season 4',
  titleNative: 'Re:ゼロから始める異世界生活 4th season',
  poster: null,
  banner:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="4"%3E%3Crect width="8" height="4" fill="%23888"/%3E%3C/svg%3E',
  color: '#7f6ad6',
  synopsis: 'Subaru revient au point de sauvegarde.',
  genres: ['Drama', 'Fantasy'],
  episodes: 25,
  duration: 24,
  year: 2026,
  season: 'SPRING',
  format: 'TV',
  airingStatus: 'RELEASING',
  averageScore: 90,
  popularity: 300000,
  studio: 'White Fox',
  source: 'LIGHT_NOVEL',
  startDate: '2026-04-05',
  endDate: null,
  nextEpisode: null,
  siteUrl: null,
  isAdult: false,
  cachedAt: Date.now(),
});

const seedEntries = [
  {
    animeId: 999001,
    status: 'watching',
    currentEpisode: 3,
    currentSeason: 4,
    currentPart: null,
    currentArc: null,
    rating: null,
    notes: '',
    notesUpdatedAt: null,
    favorite: false,
    rewatches: 0,
    addedAt: iso(5),
    updatedAt: iso(30),
    startedAt: iso(5),
    completedAt: null,
    history: [],
  },
  {
    animeId: 21,
    status: 'watching',
    currentEpisode: 1118,
    currentSeason: null,
    currentPart: null,
    currentArc: 'Egghead Arc',
    rating: 9.2,
    notes: 'Reprendre plus tard.',
    notesUpdatedAt: iso(2),
    favorite: true,
    rewatches: 0,
    addedAt: iso(400),
    updatedAt: iso(1),
    startedAt: iso(400),
    completedAt: null,
    history: [
      { at: iso(40), episode: 1100 },
      { at: iso(20), episode: 1110 },
      { at: iso(1), episode: 1118 },
    ],
  },
  {
    animeId: 113415,
    status: 'completed',
    currentEpisode: 24,
    currentSeason: 1,
    currentPart: null,
    currentArc: null,
    rating: 8.5,
    notes: '',
    notesUpdatedAt: null,
    favorite: false,
    rewatches: 1,
    addedAt: iso(200),
    updatedAt: iso(15),
    startedAt: iso(200),
    completedAt: iso(15),
    history: [
      { at: iso(60), episode: 12 },
      { at: iso(15), episode: 24 },
    ],
  },
];

await goto('/');
await evaluate(`
  localStorage.setItem('kagami:v1:entries', ${JSON.stringify(JSON.stringify(seedEntries))});
  localStorage.setItem('kagami:v1:animes', ${JSON.stringify(JSON.stringify(seedAnimes))});
  true;
`);

// ------------------------------------------------------------------- checks
const results = [];
let failed = false;

async function checkRoute(path, expectations) {
  await goto(path);
  const text = await waitForText(expectations);
  const missing = expectations.filter((needle) => !text.includes(needle));
  const routeProblems = [...problems];

  if (missing.length === 0 && routeProblems.length === 0) {
    results.push(`OK   ${path}`);
  } else {
    failed = true;
    results.push(
      `FAIL ${path}` +
        (missing.length ? `\n     manquant : ${missing.join(' | ')}` : '') +
        (routeProblems.length ? `\n     ${routeProblems.join('\n     ')}` : ''),
    );
  }
}

const EP_1118 = `\u00c9pisode 1118 / 1150`;
const EP_1119 = `\u00c9pisode 1119 / 1150`;

// The personal score must be readable without opening anything.
await checkRoute('/', ['ONE PIECE', EP_1118, 'Egghead Arc', 'Continuer', '9.2']);
await checkRoute('/library', [
  'Ma watchlist',
  'ONE PIECE',
  'Jujutsu Kaisen',
  '1118 / 1150',
  '9.2',
  '8.5',
]);
await checkRoute('/library/completed', ['Jujutsu Kaisen', '8.5']);
// Discover is tabbed now: the default tab shows "Le moment" only.
await checkRoute('/discover', [
  'Le moment',
  'Pour toi',
  'Classements',
  'Par genre',
  'Tendances du moment',
  'En diffusion',
]);

// Switching tab must actually swap the rails.
await clickByText('Classements');
const rankings = await waitForText(['Les plus aim\u00e9s au monde', 'Les mieux not\u00e9s']);
if (rankings.includes('Les plus aim\u00e9s au monde') && !rankings.includes('Tendances du moment')) {
  results.push('OK   /discover \u2014 l onglet Classements remplace bien les rails');
} else {
  failed = true;
  results.push('FAIL /discover \u2014 le changement d onglet ne remplace pas le contenu');
}
await checkRoute('/stats', [
  'Statistiques',
  'Temps de visionnage',
  '\u00c9pisodes par mois',
  'Genres pr\u00e9f\u00e9r\u00e9s',
]);
await checkRoute('/calendar', ['Calendrier', 'ONE PIECE', '\u00c9pisode 1121']);
await checkRoute('/releases', [
  'Derni\u00e8res sorties',
  'Dans mes s\u00e9ries',
  'Tout ce qui vient de sortir',
]);
await checkRoute('/settings', [
  'Param\u00e8tres',
  'Langue des titres',
  'Exporter',
  'Importer depuis AniList',
  'Ne jamais rien perdre',
  'Stockage prot\u00e9g\u00e9',
  'Points de restauration',
]);
await checkRoute('/anime/113415', ['Jujutsu Kaisen', 'Mon suivi', 'Synopsis', 'MAPPA']);
await checkRoute('/route-inexistante', ['Page introuvable']);

// A real interaction: "+1 episode" must persist through a reload.
await goto('/');
await waitForText([EP_1118]);
// The card mounts a frame after the text lands; wait for the control itself.
await waitForButton('Continuer');
const clickedContinue = await evaluate(`
  (() => {
    const buttons = [...document.querySelectorAll('button')];
    const next = buttons.find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Continuer'));
    if (!next) {
      return {
        ok: false,
        url: location.pathname,
        labels: buttons.map((b) => b.getAttribute('aria-label')).filter(Boolean).slice(0, 8),
        head: document.body.innerText.slice(0, 200),
      };
    }
    next.click();
    return { ok: true };
  })()
`);
if (!clickedContinue.ok) {
  failed = true;
  results.push(`FAIL bouton Continuer introuvable : ${JSON.stringify(clickedContinue)}`);
  if (problems.length) results.push(`     console: ${problems.join(' | ')}`);
}
await sleep(700);
const afterClick = await evaluate('document.body.innerText');
await goto('/');
const afterReload = await waitForText([EP_1119]);

if (afterClick.includes(EP_1119) && afterReload.includes(EP_1119)) {
  results.push('OK   « Continuer » incremente et persiste apres rechargement');
} else {
  failed = true;
  results.push('FAIL « Continuer » n a pas persiste');
}

// A restore point must be taken automatically on first launch with data.
await goto('/settings');
await waitForText(['Points de restauration']);
const snapshotState = await evaluate(`
  (() => {
    const raw = localStorage.getItem('kagami:v1:snapshots');
    if (!raw) return { count: 0 };
    const list = JSON.parse(raw);
    return { count: list.length, entries: list[0]?.entries?.length ?? 0, reason: list[0]?.reason };
  })()
`);

if (snapshotState.count > 0 && snapshotState.entries === seedEntries.length) {
  results.push(
    `OK   point de restauration automatique (${snapshotState.entries} series, ${snapshotState.reason})`,
  );
} else {
  failed = true;
  results.push(`FAIL point de restauration : ${JSON.stringify(snapshotState)}`);
}

/**
 * Clicks the first button whose visible label contains `label`.
 * `scope` matters: modals are portalled to the end of <body>, so a bare
 * document-wide search would keep finding the trigger instead of the confirm.
 */
async function clickByText(label, scope = 'body') {
  const clicked = await evaluate(`
    (() => {
      const root = document.querySelector(${JSON.stringify(scope)});
      if (!root) return false;
      const target = [...root.querySelectorAll('button')]
        .find((b) => b.textContent.includes(${JSON.stringify(label)}));
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
  if (!clicked) {
    failed = true;
    results.push(`FAIL bouton introuvable : « ${label} » dans ${scope}`);
  }
  return clicked;
}

const DIALOG = '[role="dialog"]';

/** Polls until a button with an aria-label starting with `prefix` exists. */
async function waitForButton(prefix, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await evaluate(`
      [...document.querySelectorAll('button')]
        .some((b) => (b.getAttribute('aria-label') ?? '').startsWith(${JSON.stringify(prefix)}))
    `);
    if (found) return true;
    await sleep(250);
  }
  return false;
}

// The core promise, end to end: wiping everything must leave the watchlist
// recoverable from a restore point.
await goto('/settings');
await waitForText(['Points de restauration']);

await clickByText('Effacer toutes mes données');
await sleep(450);
await clickByText('Effacer définitivement', DIALOG);
await sleep(900);

const afterReset = await evaluate(`
  (() => ({
    entries: JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]').length,
    snapshots: JSON.parse(localStorage.getItem('kagami:v1:snapshots') ?? '[]').length,
  }))()
`);

if (afterReset.entries === 0 && afterReset.snapshots > 0) {
  results.push('OK   effacement total : donnees vidées, points de restauration conservés');
} else {
  failed = true;
  results.push(`FAIL effacement total : ${JSON.stringify(afterReset)}`);
}

// …and restoring must actually bring the two series back.
await waitForText(['Restaurer']);
await clickByText('Restaurer');
await sleep(450);
await clickByText('Restaurer', DIALOG);
await sleep(900);

const afterRestore = await evaluate(`
  JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]').length
`);

if (afterRestore === seedEntries.length) {
  results.push(`OK   restauration : les ${seedEntries.length} series sont revenues`);
} else {
  failed = true;
  results.push(`FAIL restauration : ${afterRestore} serie(s) au lieu de ${seedEntries.length}`);
}

// Re-seed for the remaining checks.
await evaluate(`
  localStorage.setItem('kagami:v1:animes', ${JSON.stringify(JSON.stringify(seedAnimes))});
  true;
`);

// Regression guard: the decorative Japanese watermark must never sit on top of
// the title. It used to be anchored to the bottom of the banner, exactly where
// a two-line romaji title lands.
await goto('/anime/999001');
await waitForText(['Seikatsu 4th Season']);
const heroLayout = await evaluate(`
  (() => {
    const h1 = document.querySelector('h1');
    if (!h1) return { error: 'h1 absent' };

    const marks = [...document.querySelectorAll('p[aria-hidden="true"]')]
      .filter((p) => getComputedStyle(p).fontFamily.includes('Noto Sans JP'));

    const a = h1.getBoundingClientRect();
    const overlaps = marks
      .filter((m) => m.offsetParent !== null)
      .map((m) => m.getBoundingClientRect())
      .filter((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);

    // Geometry alone missed the real defect: the banner's absolutely positioned
    // gradients painted OVER the title. Hit-test every line of the h1 and the
    // badge row, and check the topmost element is really them.
    const lineHeight = parseFloat(getComputedStyle(h1).lineHeight);
    const lines = Math.max(1, Math.round(a.height / lineHeight));
    const covered = [];
    for (let i = 0; i < lines; i++) {
      const y = a.top + lineHeight * (i + 0.5);
      const x = a.left + 12;
      const top = document.elementFromPoint(x, y);
      if (top !== h1 && !h1.contains(top)) {
        covered.push({ line: i + 1, by: top ? top.tagName + '.' + String(top.className).slice(0, 45) : 'null' });
      }
    }

    return {
      lines,
      titleVisible: a.width > 0 && a.height > 0 && a.top >= 0,
      overlapCount: overlaps.length,
      coveredLines: covered,
    };
  })()
`);

if (
  heroLayout.overlapCount === 0 &&
  heroLayout.titleVisible &&
  heroLayout.coveredLines?.length === 0
) {
  results.push(
    `OK   fiche : titre sur ${heroLayout.lines} lignes, aucune ligne masquee par le bandeau`,
  );
} else {
  failed = true;
  results.push(`FAIL bandeau de la fiche : ${JSON.stringify(heroLayout)}`);
}

// Regression guard: notes typed in the tracking panel must survive navigation.
// They were silently written as an empty string before the autosave rewrite.
await goto('/anime/21');
await waitForText(['Mon suivi']);
const typedNotes = await evaluate(`
  (() => {
    const area = document.querySelector('textarea');
    if (!area) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, 'reprendre apres l arc filler');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
if (!typedNotes) {
  failed = true;
  results.push('FAIL zone de notes introuvable sur /anime/21');
}
await sleep(1200);
await goto('/library');
await sleep(600);
await goto('/anime/21');
await waitForText(['Mon suivi']);
const savedNotes = await evaluate(`document.querySelector('textarea')?.value ?? ''`);

if (savedNotes === 'reprendre apres l arc filler') {
  results.push('OK   les notes personnelles persistent apres navigation');
} else {
  failed = true;
  results.push(`FAIL notes non persistees : "${savedNotes}"`);
}

// The rating panel must be reachable from a card without hovering.
await goto('/library');
await sleep(1200);
const ratingReachable = await evaluate(`
  (() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Noter et annoter'));
    if (!b) return 'absent';
    let node = b;
    while (node && node !== document.body) {
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.pointerEvents === 'none' || s.opacity === '0') return 'bloque';
      node = node.parentElement;
    }
    return 'atteignable';
  })()
`);

if (ratingReachable === 'atteignable') {
  results.push('OK   noter/annoter atteignable sans survol depuis une carte');
} else {
  failed = true;
  results.push(`FAIL bouton de notation : ${ratingReachable}`);
}

// The command palette must open on Ctrl+K.
await goto('/');
await sleep(500);
await send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'k',
  code: 'KeyK',
  windowsVirtualKeyCode: 75,
  modifiers: 2,
});
await sleep(500);
const paletteOpen = await evaluate(
  `!!document.querySelector('[role="dialog"][aria-label="Recherche"]')`,
);
if (paletteOpen) {
  results.push('OK   Ctrl+K ouvre la palette de recherche');
} else {
  failed = true;
  results.push('FAIL Ctrl+K n ouvre pas la palette');
}

// ------------------------------------------------------------------- mobile
async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile,
  });
}

/** No screen may scroll sideways, at any of the supported widths. */
async function checkNoHorizontalScroll(path, width) {
  await goto(path);
  await sleep(1200);
  const overflow = await evaluate(`
    (() => {
      const doc = document.documentElement;
      const widest = [...document.body.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map((el) => el.tagName + '.' + (el.className?.toString?.().slice(0, 40) ?? ''));
      return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, widest: widest.slice(0, 3) };
    })()
  `);

  if (overflow.scrollWidth <= overflow.innerWidth + 1) {
    results.push(`OK   ${width}px ${path} — pas de debordement horizontal`);
  } else {
    failed = true;
    results.push(
      `FAIL ${width}px ${path} — scrollWidth ${overflow.scrollWidth} > ${overflow.innerWidth}` +
        (overflow.widest.length ? `\n     ${overflow.widest.join('\n     ')}` : ''),
    );
  }
}

await setViewport(375, 812, true);
for (const path of [
  '/',
  '/library',
  '/discover',
  '/stats',
  '/calendar',
  '/releases',
  '/settings',
  '/anime/113415',
]) {
  await checkNoHorizontalScroll(path, 375);
}

// The bottom bar replaces the sidebar below the lg breakpoint.
await goto('/');
await sleep(900);
const mobileNav = await evaluate(`
  (() => {
    const nav = document.querySelector('nav[aria-label="Navigation principale"]');
    if (!nav) return { present: false };
    const style = getComputedStyle(nav);
    const sidebar = document.querySelector('aside');
    return {
      present: style.display !== 'none',
      items: nav.querySelectorAll('a').length,
      sidebarHidden: !sidebar || getComputedStyle(sidebar).display === 'none',
    };
  })()
`);

if (mobileNav.present && mobileNav.items === 5 && mobileNav.sidebarHidden) {
  results.push('OK   375px — barre de navigation basse (5 entrees), sidebar masquee');
} else {
  failed = true;
  results.push(`FAIL 375px — navigation mobile : ${JSON.stringify(mobileNav)}`);
}

await setViewport(768, 1024, true);
await checkNoHorizontalScroll('/', 768);
await checkNoHorizontalScroll('/library', 768);

console.log(results.join('\n'));
console.log(failed ? '\nDes verifications UI echouent.' : '\nToutes les verifications UI passent.');

socket.close();
chrome.kill();
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  /* profil temporaire */
}
process.exit(failed ? 1 : 0);
