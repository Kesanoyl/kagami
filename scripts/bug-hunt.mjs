/**
 * Reproduction harness for the reported rating/notes bugs.
 * Drives the built app and reports what actually happens, per surface.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:4173';
const PORT = 9444;
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const profile = mkdtempSync(join(tmpdir(), 'kagami-bug-'));
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
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
  } catch {
    /* wait */
  }
  await sleep(250);
}

const target = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => socket.addEventListener('open', r, { once: true }));

let id = 1;
const waiting = new Map();
const listeners = [];
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    const { resolve, reject } = waiting.get(m.id);
    waiting.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method) listeners.forEach((fn) => fn(m));
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = id++;
    waiting.set(n, { resolve, reject });
    socket.send(JSON.stringify({ id: n, method, params }));
  });

let problems = [];
listeners.push((m) => {
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    problems.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown')
    problems.push(m.params.exceptionDetails.exception?.description ?? '');
});

await send('Runtime.enable');
await send('Page.enable');

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval');
  return r.result.value;
};

async function goto(path) {
  problems = [];
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(2500);
}

const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
const seedAnimes = [
  {
    id: 21, malId: 21, title: 'ONE PIECE', titleEnglish: 'ONE PIECE', titleNative: 'ONE PIECE',
    poster: null, banner: null, color: '#e4a15d', synopsis: 'x', genres: ['Action'],
    episodes: 1150, duration: 24, year: 1999, season: 'FALL', format: 'TV',
    airingStatus: 'RELEASING', averageScore: 88, popularity: 500000, studio: 'Toei',
    source: 'MANGA', startDate: null, endDate: null, nextEpisode: null,
    siteUrl: null, isAdult: false, cachedAt: Date.now(),
  },
  {
    id: 113415, malId: 40748, title: 'Jujutsu Kaisen', titleEnglish: 'JUJUTSU KAISEN',
    titleNative: 'JJK', poster: null, banner: null, color: '#e4c9a1', synopsis: 'y',
    genres: ['Action'], episodes: 24, duration: 24, year: 2020, season: 'FALL', format: 'TV',
    airingStatus: 'FINISHED', averageScore: 86, popularity: 400000, studio: 'MAPPA',
    source: 'MANGA', startDate: null, endDate: null, nextEpisode: null,
    siteUrl: null, isAdult: false, cachedAt: Date.now(),
  },
];
const seedEntries = [
  {
    animeId: 21, status: 'watching', currentEpisode: 1118, currentSeason: null, currentPart: null,
    currentArc: 'Egghead', rating: null, notes: '', notesUpdatedAt: null, favorite: false,
    rewatches: 0, addedAt: iso(400), updatedAt: iso(1), startedAt: iso(400), completedAt: null,
    history: [{ at: iso(1), episode: 1118 }],
  },
  {
    animeId: 113415, status: 'watching', currentEpisode: 10, currentSeason: null, currentPart: null,
    currentArc: null, rating: null, notes: '', notesUpdatedAt: null, favorite: false,
    rewatches: 0, addedAt: iso(200), updatedAt: iso(9), startedAt: iso(200), completedAt: null,
    history: [{ at: iso(9), episode: 10 }],
  },
];

await goto('/');
await evaluate(`
  localStorage.setItem('kagami:v1:entries', ${JSON.stringify(JSON.stringify(seedEntries))});
  localStorage.setItem('kagami:v1:animes', ${JSON.stringify(JSON.stringify(seedAnimes))});
  true;
`);

const findings = [];
const report = (ok, label, detail = '') =>
  findings.push(`${ok ? 'OK  ' : 'BUG '} ${label}${detail ? `\n       ${detail}` : ''}`);

// ---------------------------------------------------------------------------
// 1. Can the edit panel be opened from a Library card WITHOUT hovering?
//    (i.e. is it reachable on a touch device at all?)
// ---------------------------------------------------------------------------
await goto('/library');
/** Walks up the tree looking for anything that would block a real tap. */
const REACHABILITY = `
  (() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Noter et annoter'));
    if (!b) return { exists: false };
    let node = b;
    while (node && node !== document.body) {
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none' || s.opacity === '0') {
        return { exists: true, reachable: false, blockedBy: node.tagName + '/' + (s.display === 'none' ? 'display:none' : s.pointerEvents === 'none' ? 'pointer-events:none' : 'opacity:0') };
      }
      node = node.parentElement;
    }
    // Measure the real hit area, pseudo-element included, via the point the
    // browser would actually route a tap to.
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let tap = 0;
    for (let d = 2; d <= 30; d += 2) {
      const el = document.elementFromPoint(cx, cy - r.height / 2 - d);
      if (!el || !b.contains(el) && el !== b) break;
      tap = d;
    }
    return {
      exists: true,
      reachable: true,
      size: Math.round(r.width) + 'x' + Math.round(r.height),
      tapHeight: Math.round(r.height + tap * 2),
    };
  })()
`;

const editBtn = await evaluate(REACHABILITY);
report(
  editBtn.exists && editBtn.reachable,
  'ouvrir le panneau de notation depuis une carte SANS survol',
  JSON.stringify(editBtn),
);

// Click it programmatically and see whether the modal appears.
await evaluate(`
  (() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Noter et annoter'));
    if (b) b.click();
    return true;
  })()
`);
await sleep(700);
const modalOpen = await evaluate(`!!document.querySelector('[role="dialog"]')`);
report(modalOpen, 'le clic programmatique sur « Modifier le suivi » ouvre bien la modale');

// ---------------------------------------------------------------------------
// 2. Does clicking a star actually store a rating?
// ---------------------------------------------------------------------------
if (modalOpen) {
  const clicked = await evaluate(`
    (() => {
      const dialog = document.querySelector('[role="dialog"]');
      const star = [...dialog.querySelectorAll('button')]
        .find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Noter 8.0'));
      if (!star) return { found: false, labels: [...dialog.querySelectorAll('button')].map(b => b.getAttribute('aria-label')).filter(Boolean).slice(0, 6) };
      star.click();
      return { found: true };
    })()
  `);
  await sleep(800);
  const stored = await evaluate(`
    (JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]')
      .find((e) => e.animeId === 21) ?? {}).rating ?? null
  `);
  report(clicked.found && stored === 8, 'cliquer une étoile enregistre la note', `clic=${JSON.stringify(clicked)} stocké=${stored}`);
}

// ---------------------------------------------------------------------------
// 3. Typing a note: how many writes reach storage? (per-keystroke = bug)
// ---------------------------------------------------------------------------
if (modalOpen) {
  await evaluate(`
    (() => {
      window.__writes = 0;
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => { if (k === 'kagami:v1:entries') window.__writes++; return orig(k, v); };
      return true;
    })()
  `);

  // Type 10 characters through the real React input path.
  await evaluate(`
    (() => {
      const dialog = document.querySelector('[role="dialog"]');
      const area = dialog.querySelector('textarea');
      if (!area) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      window.__area = area;
      return true;
    })()
  `);

  for (const ch of 'abcdefghij') {
    await evaluate(`
      (() => {
        const area = window.__area;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(area, area.value + ${JSON.stringify(ch)});
        area.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    await sleep(60);
  }
  await sleep(1500);

  const writeStats = await evaluate(`
    (() => {
      const entry = JSON.parse(localStorage.getItem('kagami:v1:entries') ?? '[]').find((e) => e.animeId === 21);
      return { writes: window.__writes, notes: entry?.notes ?? '' };
    })()
  `);
  report(
    writeStats.notes === 'abcdefghij' && writeStats.writes <= 4,
    'saisir une note : 1 écriture debouncée, pas une par touche',
    `écritures=${writeStats.writes} notes="${writeStats.notes}"`,
  );
}

// ---------------------------------------------------------------------------
// 4. Does editing a note reorder "En cours" on the home page?
// ---------------------------------------------------------------------------
await goto('/');
const orderBefore = await evaluate(`
  [...document.querySelectorAll('article')].map((a) => a.textContent.slice(0, 22)).slice(0, 2)
`);
report(true, `ordre « En cours » avant édition : ${JSON.stringify(orderBefore)}`);

// ---------------------------------------------------------------------------
// 5. Is there ANY way to rate from the home page?
// ---------------------------------------------------------------------------
const homeActions = await evaluate(`
  (() => {
    const labels = [...document.querySelectorAll('button')]
      .map((b) => b.getAttribute('aria-label') ?? b.textContent.trim())
      .filter(Boolean);
    return {
      hasEdit: labels.some((l) => /Modifier le suivi|Noter/i.test(l)),
      sample: labels.slice(0, 10),
    };
  })()
`);
report(homeActions.hasEdit, 'noter/annoter depuis l’accueil', JSON.stringify(homeActions.sample));

// ---------------------------------------------------------------------------
// 6. Mobile (375px): are the card actions reachable without hover?
// ---------------------------------------------------------------------------
await send('Emulation.setDeviceMetricsOverride', {
  width: 375, height: 812, deviceScaleFactor: 2, mobile: true,
});
await goto('/library');
const mobileEdit = await evaluate(REACHABILITY);
report(
  mobileEdit.exists && mobileEdit.reachable,
  '375px : noter/annoter atteignable au doigt depuis une carte',
  JSON.stringify(mobileEdit),
);

// On the home page too — that was the other half of the report.
await goto('/');
const mobileHome = await evaluate(REACHABILITY);
report(
  mobileHome.exists && mobileHome.reachable,
  '375px : noter/annoter atteignable depuis l’accueil',
  JSON.stringify(mobileHome),
);

console.log(findings.join('\n'));
if (problems.length) console.log('\nErreurs console :\n  ' + problems.join('\n  '));

socket.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* tmp */ }
