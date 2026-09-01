import {
  BarChart3,
  CalendarDays,
  Check,
  CircleOff,
  Compass,
  House,
  Library,
  ListVideo,
  Pause,
  Play,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import type { WatchStatus } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Which counter to show in the badge, if any. */
  count?: WatchStatus | 'all';
  end?: boolean;
}

/** Primary destinations — shared by the sidebar and the mobile bar. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/discover', label: 'Découvrir', icon: Compass },
  { to: '/library', label: 'Ma watchlist', icon: Library, count: 'all', end: true },
];

export const STATUS_NAV: NavItem[] = [
  { to: '/library/watching', label: 'En cours', icon: Play, count: 'watching' },
  { to: '/library/planned', label: 'À regarder', icon: ListVideo, count: 'planned' },
  { to: '/library/completed', label: 'Terminés', icon: Check, count: 'completed' },
  { to: '/library/paused', label: 'En pause', icon: Pause, count: 'paused' },
  { to: '/library/dropped', label: 'Abandonnés', icon: CircleOff, count: 'dropped' },
];

export const INSIGHT_NAV: NavItem[] = [
  { to: '/releases', label: 'Dernières sorties', icon: Radio },
  { to: '/calendar', label: 'Calendrier', icon: CalendarDays },
  { to: '/stats', label: 'Statistiques', icon: BarChart3 },
];
