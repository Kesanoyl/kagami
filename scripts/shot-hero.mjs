/** Seeds a long-title series and screenshots the detail hero for visual review. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9466;
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) =>
  existsSync(p),
);
const profile = mkdtempSync(join(tmpdir(), 'kagami-shot-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,900',
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
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(t.webSocketDebuggerUrl);
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
  new Promise((resolve, reject) => { const n = id++; waiting.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable');
await send('Runtime.enable');
const evaluate = async (e) =>
  (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;

const anime = {
  id: 999001, malId: null,
  title: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
  titleEnglish: 'Re:ZERO -Starting Life in Another World- Season 4',
  titleNative: 'Re:ゼロから始める異世界生活 4th season',
  poster: null,
  banner: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/108632-NpPSKPD3IyFo.jpg',
  color: '#7f6ad6', synopsis: 'Subaru revient au point de sauvegarde.',
  genres: ['Drama', 'Fantasy'], episodes: 25, duration: 24, year: 2026, season: 'SPRING',
  format: 'TV', airingStatus: 'RELEASING', averageScore: 90, popularity: 300000,
  studio: 'White Fox', source: 'LIGHT_NOVEL', startDate: '2026-04-05', endDate: null,
  nextEpisode: null, siteUrl: null, isAdult: false, cachedAt: Date.now(),
};
const entry = {
  animeId: 999001, status: 'watching', currentEpisode: 3, currentSeason: 4, currentPart: null,
  currentArc: null, rating: 9.0, notes: '', notesUpdatedAt: null, favorite: false, rewatches: 0,
  addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  startedAt: null, completedAt: null, history: [],
};

await send('Page.navigate', { url: `${BASE}/` });
await sleep(2500);
await evaluate(`
  localStorage.setItem('kagami:v1:entries', ${JSON.stringify(JSON.stringify([entry]))});
  localStorage.setItem('kagami:v1:animes', ${JSON.stringify(JSON.stringify([anime]))});
  true;
`);
await send('Page.navigate', { url: `${BASE}/anime/999001` });
await sleep(4000);

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(new URL('../hero-check.png', import.meta.url), Buffer.from(shot.data, 'base64'));
console.log('capture écrite : hero-check.png');

socket.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* tmp */ }
