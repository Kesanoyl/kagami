import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Compass, Library, Search, X } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTitle } from '@/components/ui/SectionHeader';
import { Select } from '@/components/ui/Field';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { STATUS_DOT } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { displayTitle, progressRatio } from '@/lib/format';
import type { LibraryEntry, WatchStatus } from '@/types';

/** Decorative Japanese kicker per status view. */
const STATUS_KICKER: Record<WatchStatus, string> = {
  watching: '視聴中',
  completed: '完了',
  planned: '予定',
  paused: '休止',
  dropped: '中断',
};

type SortKey = 'updated' | 'title' | 'progress' | 'rating' | 'added' | 'score';

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Activité récente',
  added: 'Ajout récent',
  title: 'Titre (A→Z)',
  progress: 'Progression',
  rating: 'Ma note',
  score: 'Score communauté',
};

export default function LibraryPage() {
  const { status } = useParams<{ status?: string }>();
  const { joined, counts, entries, settings, ready } = useWatchlist();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const activeStatus = STATUS_ORDER.includes(status as WatchStatus)
    ? (status as WatchStatus)
    : null;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = joined.filter(({ user, anime }) => {
      if (activeStatus && user.status !== activeStatus) return false;
      if (!needle) return true;
      return [anime.title, anime.titleEnglish, anime.titleNative, user.currentArc]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });

    return sortEntries(filtered, sort, settings.titleLanguage);
  }, [joined, activeStatus, query, sort, settings.titleLanguage]);

  const title = activeStatus ? STATUS_META[activeStatus].label : 'Ma watchlist';
  const total = activeStatus ? counts[activeStatus] : entries.length;

  return (
    <div className="space-y-7">
      <PageTitle
        kicker={activeStatus ? STATUS_KICKER[activeStatus] : 'ライブラリ'}
        title={title}
        subtitle={
          total === 0
            ? 'Aucune série pour le moment.'
            : `${total} série${total > 1 ? 's' : ''}${
                visible.length !== total
                  ? ` · ${visible.length} affichée${visible.length > 1 ? 's' : ''}`
                  : ''
              }`
        }
      />

      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <StatusTab to="/library" active={activeStatus === null} count={entries.length}>
          Tout
        </StatusTab>
        {STATUS_ORDER.map((item) => (
          <StatusTab
            key={item}
            to={STATUS_META[item].route}
            active={activeStatus === item}
            count={counts[item]}
            dot={item}
          >
            {STATUS_META[item].label}
          </StatusTab>
        ))}
      </nav>

      {entries.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrer dans ma liste…"
              aria-label="Filtrer dans ma liste"
              className="h-11 w-full rounded-xl border border-line bg-surface pr-10 pl-10 text-sm text-ink transition-colors duration-200 placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer le filtre"
                className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Trier"
            className="sm:w-56"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!ready ? null : visible.length === 0 ? (
        <EmptyState
          icon={query ? <Search size={22} /> : <Library size={22} />}
          title={query ? 'Aucune correspondance' : 'Rien ici pour l’instant'}
          description={
            query
              ? `Aucune série ne correspond à « ${query.trim()} ».`
              : activeStatus
                ? `Aucune série avec le statut « ${STATUS_META[activeStatus].label} ».`
                : 'Ajoute ta première série depuis Découvrir ou via la recherche (⌘K).'
          }
          action={
            !query && (
              <Link
                to="/discover"
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
              >
                <Compass size={15} /> Découvrir des animes
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map(({ user, anime }, index) => (
            <AnimeCard key={anime.id} anime={anime} entry={user} eager={index < 6} />
          ))}
        </div>
      )}
    </div>
  );
}

function sortEntries(
  entries: LibraryEntry[],
  sort: SortKey,
  language: 'romaji' | 'english',
): LibraryEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case 'title':
      return sorted.sort((a, b) =>
        displayTitle(a.anime, language).localeCompare(displayTitle(b.anime, language), 'fr'),
      );
    case 'progress':
      return sorted.sort(
        (a, b) => progressRatio(b.user, b.anime) - progressRatio(a.user, a.anime),
      );
    case 'rating':
      // Unrated titles sink to the bottom rather than being treated as zero.
      return sorted.sort((a, b) => (b.user.rating ?? -1) - (a.user.rating ?? -1));
    case 'score':
      return sorted.sort((a, b) => (b.anime.averageScore ?? -1) - (a.anime.averageScore ?? -1));
    case 'added':
      return sorted.sort((a, b) => b.user.addedAt.localeCompare(a.user.addedAt));
    case 'updated':
    default:
      return sorted.sort((a, b) => b.user.updatedAt.localeCompare(a.user.updatedAt));
  }
}

function StatusTab({
  to,
  active,
  count,
  dot,
  children,
}: {
  to: string;
  active: boolean;
  count: number;
  dot?: WatchStatus;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color] duration-200',
        active
          ? 'border-brand/40 bg-brand/15 text-ink'
          : 'border-line bg-surface/60 text-ink-dim hover:border-line-strong hover:text-ink',
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[dot])} aria-hidden />}
      {children}
      <span className="tnum text-ink-faint">{count}</span>
    </Link>
  );
}
