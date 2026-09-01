import type { WatchStatus } from '@/types';

export interface StatusMeta {
  id: WatchStatus;
  label: string;
  short: string;
  /** Tailwind token suffix, e.g. `st-watching`. */
  token: string;
  route: string;
}

export const STATUS_META: Record<WatchStatus, StatusMeta> = {
  watching: {
    id: 'watching',
    label: 'En cours',
    short: 'En cours',
    token: 'st-watching',
    route: '/library/watching',
  },
  completed: {
    id: 'completed',
    label: 'Terminés',
    short: 'Terminé',
    token: 'st-completed',
    route: '/library/completed',
  },
  planned: {
    id: 'planned',
    label: 'À regarder',
    short: 'À regarder',
    token: 'st-planned',
    route: '/library/planned',
  },
  paused: {
    id: 'paused',
    label: 'En pause',
    short: 'En pause',
    token: 'st-paused',
    route: '/library/paused',
  },
  dropped: {
    id: 'dropped',
    label: 'Abandonnés',
    short: 'Abandonné',
    token: 'st-dropped',
    route: '/library/dropped',
  },
};

export const STATUS_ORDER: WatchStatus[] = [
  'watching',
  'planned',
  'completed',
  'paused',
  'dropped',
];

/** Hex mirrors of the CSS tokens — needed by Recharts, which cannot read CSS vars. */
export const STATUS_HEX: Record<WatchStatus, string> = {
  watching: '#818cf8',
  completed: '#34d399',
  planned: '#38bdf8',
  paused: '#fbbf24',
  dropped: '#fb7185',
};

export const CHART_HEX = ['#818cf8', '#a855f7', '#38bdf8', '#34d399', '#fbbf24', '#fb7185'];

export const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const FORMAT_LABEL: Record<string, string> = {
  TV: 'Série TV',
  TV_SHORT: 'Format court',
  MOVIE: 'Film',
  SPECIAL: 'Spécial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Clip',
};

export const AIRING_LABEL: Record<string, string> = {
  FINISHED: 'Terminé',
  RELEASING: 'En diffusion',
  NOT_YET_RELEASED: 'À venir',
  CANCELLED: 'Annulé',
  HIATUS: 'En pause',
};

export const SEASON_LABEL: Record<string, string> = {
  WINTER: 'Hiver',
  SPRING: 'Printemps',
  SUMMER: 'Été',
  FALL: 'Automne',
};

export const SOURCE_LABEL: Record<string, string> = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  VISUAL_NOVEL: 'Visual novel',
  VIDEO_GAME: 'Jeu vidéo',
  NOVEL: 'Roman',
  DOUJINSHI: 'Doujinshi',
  ANIME: 'Anime',
  WEB_NOVEL: 'Web novel',
  MANHWA: 'Manhwa',
  LIVE_ACTION: 'Live action',
  GAME: 'Jeu',
  COMIC: 'Comic',
  OTHER: 'Autre',
};

export const RELATION_LABEL: Record<string, string> = {
  PREQUEL: 'Préquelle',
  SEQUEL: 'Suite',
  SIDE_STORY: 'Histoire parallèle',
  PARENT: 'Œuvre principale',
  ALTERNATIVE: 'Version alternative',
};
