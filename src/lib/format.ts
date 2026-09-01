import type { Anime, Settings, UserAnime } from '@/types';

/** Picks the title in the user's preferred language, with a graceful fallback. */
export function displayTitle(anime: Anime, language: Settings['titleLanguage']): string {
  if (language === 'english') return anime.titleEnglish ?? anime.title;
  return anime.title ?? anime.titleEnglish ?? 'Sans titre';
}

/** The other title, only when it actually differs — avoids duplicated lines. */
export function altTitle(anime: Anime, language: Settings['titleLanguage']): string | null {
  const main = displayTitle(anime, language);
  const other = language === 'english' ? anime.title : anime.titleEnglish;
  if (!other || other === main) return null;
  return other;
}

export function progressRatio(user: UserAnime, anime: Anime): number {
  if (!anime.episodes || anime.episodes <= 0) return user.status === 'completed' ? 1 : 0;
  return Math.min(1, user.currentEpisode / anime.episodes);
}

export function progressPercent(user: UserAnime, anime: Anime): number {
  return Math.round(progressRatio(user, anime) * 100);
}

/** "18 jours 7 h" — the headline number on the stats page. */
export function formatWatchTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

export function formatCompactWatchTime(minutes: number): string {
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

export const formatDay = (date: Date) => DAY_FORMAT.format(date);
export const formatDate = (date: Date) => DATE_FORMAT.format(date);
export const formatShortDate = (date: Date) => SHORT_DATE_FORMAT.format(date);
export const formatTime = (date: Date) => TIME_FORMAT.format(date);
export const formatMonth = (date: Date) => MONTH_FORMAT.format(date);

export function formatISODate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMAT.format(date);
}

/** "il y a 3 jours" — used on notes and completion timestamps. */
export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.round(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.round(months / 12)} an${months >= 24 ? 's' : ''}`;
}

/** Countdown to the next episode: "dans 2 j 4 h". */
export function countdown(airingAt: number): string {
  const seconds = airingAt - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return 'disponible';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `dans ${days} j ${hours} h`;
  if (hours > 0) return `dans ${hours} h ${minutes} min`;
  return `dans ${minutes} min`;
}

/** Community score is 0–100 on AniList; we show the familiar /10. */
export function communityScore(score: number | null): string | null {
  if (score == null) return null;
  return (score / 10).toFixed(1);
}

export function formatRating(rating: number | null): string {
  if (rating == null) return '—';
  return Number.isInteger(rating) ? `${rating}.0` : rating.toFixed(1);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count > 1 ? plural : singular;
}
