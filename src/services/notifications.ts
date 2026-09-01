import type { Anime, AppNotification, Settings, UserAnime } from '@/types';

/**
 * Local reminder engine.
 *
 * It derives reminders from catalogue data the app already holds — no backend,
 * no push. The shape (`AppNotification`) is what a future service worker or
 * server-side job would produce, so the UI will not change when one is added.
 */

const DAY = 86_400;

function id(kind: string, animeId: number, marker: string | number): string {
  return `${kind}:${animeId}:${marker}`;
}

export function buildNotifications(
  entries: UserAnime[],
  freshAnimes: Anime[],
  existing: AppNotification[],
  settings: Settings,
): AppNotification[] {
  const known = new Set(existing.map((n) => n.id));
  const byId = new Map(entries.map((e) => [e.animeId, e]));
  const now = Math.floor(Date.now() / 1000);
  const created: AppNotification[] = [];

  for (const anime of freshAnimes) {
    const entry = byId.get(anime.id);
    if (!entry || entry.status === 'dropped') continue;

    const next = anime.nextEpisode;

    if (settings.reminders.newEpisode && next) {
      // Everything before `next.episode` has already aired.
      const lastAired = next.episode - 1;
      if (lastAired > entry.currentEpisode) {
        const notificationId = id('new-episode', anime.id, lastAired);
        if (!known.has(notificationId)) {
          const behind = lastAired - entry.currentEpisode;
          created.push({
            id: notificationId,
            animeId: anime.id,
            kind: 'new-episode',
            title: anime.title,
            body:
              behind === 1
                ? `L'épisode ${lastAired} est disponible.`
                : `${behind} épisodes en attente — tu en es à l'épisode ${entry.currentEpisode}.`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }
    }

    if (settings.reminders.airingSoon && next && next.airingAt - now <= DAY && next.airingAt > now) {
      const notificationId = id('airing-soon', anime.id, next.episode);
      if (!known.has(notificationId)) {
        created.push({
          id: notificationId,
          animeId: anime.id,
          kind: 'airing-soon',
          title: anime.title,
          body: `Épisode ${next.episode} dans moins de 24 h.`,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    if (
      settings.reminders.seriesFinished &&
      anime.airingStatus === 'FINISHED' &&
      entry.status === 'watching' &&
      anime.episodes &&
      entry.currentEpisode < anime.episodes
    ) {
      const notificationId = id('finished', anime.id, anime.episodes);
      if (!known.has(notificationId)) {
        created.push({
          id: notificationId,
          animeId: anime.id,
          kind: 'finished',
          title: anime.title,
          body: `La série est terminée — il te reste ${anime.episodes - entry.currentEpisode} épisodes.`,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }
  }

  if (created.length === 0) return existing;
  return [...created, ...existing].slice(0, 50);
}
