/**
 * Exercises the pure tracking rules (no DOM, no network).
 * Node strips the TypeScript types natively — run with `node scripts/smoke-logic.mjs`.
 */
import assert from 'node:assert/strict';
import { applyEpisode, applyStatus, createEntry, pendingEpisodes } from '../src/lib/progress.ts';
import { buildBackup, parseBackup, previewImport } from '../src/services/storage/backup.ts';
import { coerceEntries, coerceSettings } from '../src/services/storage/coerce.ts';
import { mergeEntries, sameEntries } from '../src/lib/merge.ts';

const anime = {
  id: 1,
  malId: null,
  title: 'Test',
  titleEnglish: null,
  titleNative: null,
  poster: null,
  banner: null,
  color: null,
  synopsis: null,
  genres: ['Action'],
  episodes: 12,
  duration: 24,
  year: 2026,
  season: null,
  format: 'TV',
  airingStatus: 'RELEASING',
  averageScore: 80,
  popularity: 100,
  studio: null,
  source: null,
  startDate: null,
  endDate: null,
  nextEpisode: { episode: 9, airingAt: 0 },
  siteUrl: null,
  cachedAt: Date.now(),
};

const checks = [];
const check = (label, fn) => {
  try {
    fn();
    checks.push(`✓ ${label}`);
  } catch (error) {
    checks.push(`✗ ${label} — ${error.message}`);
    process.exitCode = 1;
  }
};

check('un nouvel ajout démarre à zéro', () => {
  const entry = createEntry(anime, 'planned');
  assert.equal(entry.currentEpisode, 0);
  assert.equal(entry.status, 'planned');
  assert.equal(entry.history.length, 0);
});

check('ajouter directement en « terminé » remplit le compteur', () => {
  const entry = createEntry(anime, 'completed');
  assert.equal(entry.currentEpisode, 12);
  assert.ok(entry.completedAt);
  assert.equal(entry.history.length, 1);
});

check('ajout avec note, remarque et épisode en une fois', () => {
  const entry = createEntry(anime, 'watching', {
    currentEpisode: 5,
    rating: 8.5,
    notes: '  conseillé par un ami  ',
  });
  assert.equal(entry.status, 'watching');
  assert.equal(entry.currentEpisode, 5);
  assert.equal(entry.rating, 8.5);
  assert.equal(entry.notes, 'conseillé par un ami', 'la remarque est nettoyée');
  assert.ok(entry.notesUpdatedAt, 'une remarque saisie est horodatée');
  assert.equal(entry.history.length, 1, 'la progression initiale alimente les stats');
  assert.equal(entry.history[0].episode, 5);
});

check('ajout en « terminé » avec une note : le compteur est rempli', () => {
  const entry = createEntry(anime, 'completed', { rating: 10, currentEpisode: 3 });
  // Le statut prime : « terminé » veut dire tous les épisodes.
  assert.equal(entry.currentEpisode, 12);
  assert.equal(entry.rating, 10);
  assert.ok(entry.completedAt);
});

check('ajout sans rien saisir reste neutre', () => {
  const entry = createEntry(anime, 'planned', {});
  assert.equal(entry.currentEpisode, 0);
  assert.equal(entry.rating, null);
  assert.equal(entry.notes, '');
  assert.equal(entry.notesUpdatedAt, null);
  assert.deepEqual(entry.history, []);
});

check('une remarque vide ne crée pas de date de modification', () => {
  const entry = createEntry(anime, 'watching', { notes: '   ' });
  assert.equal(entry.notes, '');
  assert.equal(entry.notesUpdatedAt, null);
});

check('l’épisode saisi est borné au total', () => {
  assert.equal(createEntry(anime, 'watching', { currentEpisode: 999 }).currentEpisode, 12);
  assert.equal(createEntry(anime, 'watching', { currentEpisode: -4 }).currentEpisode, 0);
});

check('+1 depuis « à regarder » bascule en « en cours »', () => {
  const { entry, justCompleted } = applyEpisode(createEntry(anime, 'planned'), anime, 1, true);
  assert.equal(entry.status, 'watching');
  assert.equal(entry.currentEpisode, 1);
  assert.equal(justCompleted, false);
  assert.equal(entry.history.length, 1);
});

check('atteindre le dernier épisode termine la série', () => {
  const { entry, justCompleted } = applyEpisode(createEntry(anime, 'watching'), anime, 12, true);
  assert.equal(entry.status, 'completed');
  assert.equal(justCompleted, true);
  assert.ok(entry.completedAt);
});

check('autoComplete désactivé laisse le statut intact', () => {
  const { entry, justCompleted } = applyEpisode(createEntry(anime, 'watching'), anime, 12, false);
  assert.equal(entry.status, 'watching');
  assert.equal(justCompleted, false);
});

check('la progression est bornée au nombre total d’épisodes', () => {
  const { entry } = applyEpisode(createEntry(anime, 'watching'), anime, 999, true);
  assert.equal(entry.currentEpisode, 12);
});

check('revenir en arrière depuis « terminé » repasse en « en cours »', () => {
  const done = applyEpisode(createEntry(anime, 'watching'), anime, 12, true).entry;
  const { entry } = applyEpisode(done, anime, 5, true);
  assert.equal(entry.status, 'watching');
  assert.equal(entry.completedAt, null);
});

check('marquer « terminé » à la main remplit le compteur', () => {
  const entry = applyStatus(createEntry(anime, 'watching'), anime, 'completed');
  assert.equal(entry.currentEpisode, 12);
  assert.ok(entry.completedAt);
});

check('les épisodes diffusés non vus sont comptés', () => {
  const entry = { ...createEntry(anime, 'watching'), currentEpisode: 5 };
  // nextEpisode = 9 → les épisodes 1 à 8 sont sortis, il en reste 3.
  assert.equal(pendingEpisodes(entry, anime), 3);
});

check('export → import conserve la progression', () => {
  const entry = { ...createEntry(anime, 'watching'), currentEpisode: 7, rating: 8.5, notes: 'ok' };
  const backup = buildBackup([entry], [anime], {
    titleLanguage: 'romaji',
    sidebarCollapsed: false,
    autoComplete: true,
    reminders: { newEpisode: true, airingSoon: true, seriesFinished: false },
    adultContent: false,
  });
  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].currentEpisode, 7);
  assert.equal(parsed.entries[0].rating, 8.5);
  assert.equal(parsed.animes.length, 1);

  const preview = previewImport(parsed, []);
  assert.equal(preview.newEntries, 1);
  assert.equal(preview.updatedEntries, 0);

  const previewAgainstSelf = previewImport(parsed, [entry]);
  assert.equal(previewAgainstSelf.unchangedEntries, 1);
});

check('un JSON invalide est rejeté proprement', () => {
  assert.throws(() => parseBackup('{"nope":1}'));
  assert.throws(() => parseBackup('pas du json'));
});

// --- Deux onglets ouverts ne doivent jamais s'écraser l'un l'autre ----------

check('fusion : une série ajoutée dans l’autre onglet est conservée', () => {
  const a = [{ ...createEntry(anime, 'watching'), animeId: 1, updatedAt: '2026-01-01T10:00:00Z' }];
  const b = [
    { ...createEntry(anime, 'watching'), animeId: 1, updatedAt: '2026-01-01T10:00:00Z' },
    { ...createEntry(anime, 'planned'), animeId: 2, updatedAt: '2026-01-01T11:00:00Z' },
  ];
  const merged = mergeEntries(a, b);
  assert.equal(merged.length, 2, 'aucune des deux listes n’est écrasée');
  assert.ok(merged.find((e) => e.animeId === 2));
});

check('fusion : en cas de conflit, la version la plus récente gagne', () => {
  const ancien = { ...createEntry(anime, 'watching'), animeId: 1, currentEpisode: 3, updatedAt: '2026-01-01T10:00:00Z' };
  const recent = { ...createEntry(anime, 'watching'), animeId: 1, currentEpisode: 9, updatedAt: '2026-01-02T10:00:00Z' };
  assert.equal(mergeEntries([ancien], [recent])[0].currentEpisode, 9);
  assert.equal(mergeEntries([recent], [ancien])[0].currentEpisode, 9, 'l’ordre des arguments ne change rien');
});

check('fusion : une liste vide ne vide jamais l’autre', () => {
  const mienne = [{ ...createEntry(anime, 'watching'), animeId: 1 }];
  assert.equal(mergeEntries(mienne, []).length, 1);
  assert.equal(mergeEntries([], mienne).length, 1);
});

check('sameEntries détecte un vrai changement', () => {
  const base = [{ ...createEntry(anime, 'watching'), animeId: 1, updatedAt: 'A' }];
  assert.equal(sameEntries(base, [{ ...base[0] }]), true);
  assert.equal(sameEntries(base, [{ ...base[0], updatedAt: 'B' }]), false);
  assert.equal(sameEntries(base, []), false);
});

// --- La promesse centrale : une nouvelle version du site ne perd rien --------

check('une entrée écrite par une ancienne version est conservée, pas jetée', () => {
  // Tout ce qui a été ajouté après coup manque volontairement ici.
  const ancienne = [{ animeId: 21, status: 'watching', currentEpisode: 431 }];
  const [entry] = coerceEntries(ancienne);
  assert.equal(entry.animeId, 21);
  assert.equal(entry.currentEpisode, 431, 'la progression doit survivre');
  assert.equal(entry.status, 'watching');
  // Les champs absents sont comblés, jamais laissés indéfinis.
  assert.equal(entry.notes, '');
  assert.equal(entry.rating, null);
  assert.deepEqual(entry.history, []);
  assert.ok(entry.addedAt && entry.updatedAt);
});

check('un champ corrompu ne fait pas disparaître la série', () => {
  const abimee = [
    { animeId: 5, status: 'n_importe_quoi', currentEpisode: 'douze', rating: 42, history: 'nope' },
  ];
  const [entry] = coerceEntries(abimee);
  assert.equal(entry.animeId, 5, 'la série reste dans la liste');
  assert.equal(entry.status, 'planned');
  assert.equal(entry.currentEpisode, 0);
  assert.equal(entry.rating, null);
  assert.deepEqual(entry.history, []);
});

check('seules les entrées sans identifiant sont écartées', () => {
  const melange = [{ animeId: 1 }, null, 'texte', { pasDId: true }, { animeId: 2 }];
  assert.equal(coerceEntries(melange).length, 2);
});

check('les doublons ne masquent pas une entrée', () => {
  const doublons = [
    { animeId: 7, currentEpisode: 3 },
    { animeId: 7, currentEpisode: 9 },
  ];
  const result = coerceEntries(doublons);
  assert.equal(result.length, 1);
  assert.equal(result[0].currentEpisode, 3);
});

check('un nouveau réglage prend sa valeur par défaut sans écraser les anciens', () => {
  const anciens = { titleLanguage: 'english', reminders: { newEpisode: false } };
  const settings = coerceSettings(anciens);
  assert.equal(settings.titleLanguage, 'english', 'le choix existant est gardé');
  assert.equal(settings.reminders.newEpisode, false, 'le sous-réglage existant est gardé');
  assert.equal(settings.reminders.airingSoon, true, 'le réglage absent prend son défaut');
  assert.equal(settings.autoComplete, true);
});

console.log(checks.join('\n'));
console.log(process.exitCode ? '\nDes règles échouent.' : '\nToutes les règles de suivi passent.');
