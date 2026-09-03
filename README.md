# Kagami — Anime Tracker

**En ligne : https://kesanoyl.github.io/kagami/**

Application web personnelle de suivi d'animes : découvrir, ajouter, suivre, reprendre,
noter, organiser, analyser. Dark, cinématographique, pensée pour que chaque action
importante tienne en 1 à 3 clics.

## Déploiement

Chaque push sur `main` déclenche `.github/workflows/deploy.yml` : build puis mise en
ligne sur GitHub Pages.

Le site est servi depuis le sous-chemin `/kagami/`, ce qui impose trois réglages :

- `vite.config.ts` lit `base` dans `BASE_PATH` (posé par le workflow ; `/` en local) ;
- le routeur prend `basename={import.meta.env.BASE_URL}` ;
- `scripts/spa-fallback.mjs` copie `index.html` en `404.html` après le build.
  GitHub Pages n'offre aucune règle de réécriture : sans ce fichier, un rechargement
  sur `/library` renverrait une vraie page d'erreur. Les liens profonds répondent donc
  avec un statut 404 tout en servant l'application, qui route ensuite normalement.

Pour rejouer un build sous-chemin en local, `vite preview` a besoin de la **même**
variable, sinon il sert `index.html` à la place des assets :

```bash
BASE_PATH=/kagami/ npm run build
BASE_PATH=/kagami/ npx vite preview --port 4174
BASE_URL=http://localhost:4174/kagami npm run test:ui
```

`npm run test:ui` accepte `BASE_URL`, ce qui permet de valider la production :

```bash
BASE_URL=https://kesanoyl.github.io/kagami npm run test:ui
```

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Commande             | Rôle                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `npm run dev`        | Serveur de développement                                                 |
| `npm run build`      | Vérification TypeScript puis build de production                          |
| `npm run preview`    | Sert `dist/` sur le port 4173                                             |
| `npm run typecheck`  | TypeScript seul                                                           |
| `npm run test:logic` | Règles de progression + import/export, sans navigateur                    |
| `npm run test:api`   | Envoie les vraies requêtes GraphQL à AniList                              |
| `npm run test:ui`    | Chrome headless (CDP) sur le build : routes, interactions, mobile 375 px  |

`test:ui` nécessite `npm run build` puis `npm run preview` dans un autre terminal.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Motion · Recharts ·
Lucide · API **AniList GraphQL**.

## Architecture

```
src/
  components/
    anime/      cartes, contrôles de suivi, notation, panneau « Mon suivi »
    layout/     sidebar, barre supérieure, navigation mobile, notifications
    search/     palette de commandes (⌘K)
    stats/      graphiques Recharts (chargés uniquement sur /stats)
    ui/         primitives : bouton, badge, modale, toast, skeleton, poster…
  hooks/        useWatchlist, useAnimeSearch, useStatistics, useAsync, useDebounce…
  lib/          format, constantes, règles de progression (pures)
  pages/        une page par route
  services/
    api/        client AniList (cache, file d'attente, retry), requêtes, normalisation
    storage/    contrat de persistance + implémentation localStorage + sauvegardes
  store/        contextes React : bibliothèque, toasts
  types/        modèle de données
```

Trois frontières sont tenues strictement :

- **aucun composant n'appelle `fetch`** — tout passe par `services/api`, qui gère le
  cache, la déduplication des requêtes identiques, la limitation de débit (24 req/min),
  les réessais et la normalisation ;
- **aucun composant ne touche `localStorage`** — tout passe par `services/storage`,
  derrière l'interface `StorageAdapter` ;
- les données du catalogue (`Anime`) et les données personnelles (`UserAnime`) sont
  deux modèles séparés, joints par `animeId`. Rien n'est dupliqué.

## Données

Tout est stocké en local (`localStorage`, préfixe `kagami:v1`). Seules les fiches
d'animes réellement présents dans la watchlist sont persistées ; les résultats de
navigation restent en mémoire.

Passer à Supabase / Firebase demande d'écrire une seconde classe implémentant
`StorageAdapter` et de changer **une ligne** dans `src/services/storage/index.ts`.
L'interface est déjà asynchrone pour cette raison.

### Durabilité — la watchlist ne doit jamais disparaître

Quatre protections indépendantes, toutes visibles dans **Paramètres → Ne jamais
rien perdre** :

1. **Réhydratation défensive** (`services/storage/coerce.ts`). Tout ce qui est
   relu du disque passe par des fonctions qui *comblent* les champs manquants au
   lieu de rejeter l'entrée. Une série écrite par une version antérieure de l'app
   revient toujours, quels que soient les champs ajoutés depuis. Seule une entrée
   sans `animeId` exploitable est écartée. **C'est la garantie qu'une modification
   du code ne supprime rien.**
2. **Stockage non expulsable** (`services/storage/durability.ts`). Au démarrage,
   l'app appelle `navigator.storage.persist()` : le navigateur s'engage à ne pas
   effacer les données sous pression disque.
3. **Points de restauration** (`services/storage/snapshots.ts`). Un instantané par
   jour, plus un avant chaque import, effacement ou restauration. Les 6 derniers
   sont conservés — et volontairement **épargnés par « tout effacer »**, pour que
   l'opération reste réversible.
4. **Copie continue vers un fichier** (`services/storage/fileBackup.ts`). Via la
   File System Access API : le fichier est choisi une fois, son handle est gardé
   en IndexedDB, et chaque modification y est réécrite. C'est la seule protection
   qui survit à un changement de navigateur, de machine ou d'URL. Chromium
   uniquement ; ailleurs l'interface le dit et renvoie vers l'export manuel.

Et quatre garde-fous contre les scénarios qui détruisaient encore des données :

5. **Écriture qui réduit la liste → point de restauration automatique**
   (`localStorage.ts`, `saveEntries`). Quelle qu'en soit la cause — suppression
   volontaire, import, lecture ratée revenue vide, bug d'une future version.
   Les suppressions légitimes passent, elles deviennent simplement annulables.
6. **Données illisibles mises en quarantaine** plutôt que remplacées. Sans ça,
   l'app démarrait vide puis réécrivait ce vide par-dessus. Le texte brut est
   conservé sous `kagami:v1:entries.corrupt`.
7. **Fusion entre onglets** (`lib/merge.ts`). Deux onglets partagent le même
   `localStorage` : le dernier à enregistrer écrasait le travail de l'autre,
   sans la moindre erreur. Les changements sont désormais fusionnés entrée par
   entrée, le `updatedAt` le plus récent l'emportant.
8. **Récupération des données orphelines.** Si le préfixe de stockage changeait
   un jour, une watchlist vide déclenche un balayage de toutes les clés
   `kagami:*:entries` et adopte la plus fournie.

Export / import manuels également disponibles, l'import affichant un aperçu
(nouvelles / mises à jour / inchangées) avant toute écriture.

`npm run test:durability` rejoue ces scénarios dans un vrai navigateur :
corruption du stockage, changement de clé, deux onglets concurrents, et
suppression via l'interface.

⚠️ `localStorage` est lié à une **origine**. En déployant l'app sur une autre URL,
la watchlist de `localhost` ne suit pas : il faut importer le fichier de
sauvegarde une fois sur le nouveau domaine.

## Raccourcis

| Touche              | Action                       |
| ------------------- | ---------------------------- |
| `⌘K` / `Ctrl+K`     | Ouvrir la recherche globale  |
| `/`                 | Idem (hors champ de saisie)  |
| `↑` `↓`             | Naviguer dans les résultats  |
| `Entrée`            | Ouvrir la fiche              |
| `Ctrl+Entrée`       | Ajouter sans quitter         |
| `Échap`             | Fermer                       |

## Rappels

Un moteur local (`services/notifications.ts`) dérive les rappels des dates de
diffusion déjà connues : nouvel épisode disponible, diffusion imminente, série
terminée. Ils s'affichent dans la cloche et se règlent dans les Paramètres.
La forme (`AppNotification`) est celle qu'un backend ou un service worker
produirait : l'interface n'aura pas à changer le jour où l'un des deux est branché.
