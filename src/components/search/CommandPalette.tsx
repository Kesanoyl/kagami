import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CornerDownLeft, Loader2, Plus, Search, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAnimeSearch } from '@/hooks/useAnimeSearch';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Poster } from '@/components/ui/Poster';
import { StatusBadge } from '@/components/ui/Badge';
import { MyRating } from '@/components/anime/Rating';
import { communityScore, displayTitle } from '@/lib/format';
import type { Anime, UserAnime } from '@/types';
import { FORMAT_LABEL } from '@/lib/constants';

interface Row {
  anime: Anime;
  entry?: UserAnime;
  group: 'library' | 'catalog';
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  const { local, remote, loading, error, tooShort } = useAnimeSearch(query, { enabled: open });
  const { add, isInLibrary, joined, settings } = useWatchlist();

  /** With an empty field, offer the series in progress as shortcuts. */
  const suggestions = useMemo(
    () =>
      joined
        .filter((e) => e.user.status === 'watching')
        .sort((a, b) => b.user.updatedAt.localeCompare(a.user.updatedAt))
        .slice(0, 5),
    [joined],
  );

  const rows = useMemo<Row[]>(() => {
    if (query.trim().length < 2) {
      return suggestions.map((e) => ({ anime: e.anime, entry: e.user, group: 'library' as const }));
    }
    return [
      ...local.map((e) => ({ anime: e.anime, entry: e.user, group: 'library' as const })),
      ...remote.map((anime) => ({ anime, group: 'catalog' as const })),
    ];
  }, [query, suggestions, local, remote]);

  useEffect(() => setActive(0), [rows.length, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const openDetail = (anime: Anime) => {
    navigate(`/anime/${anime.id}`);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (rows.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[active];
      if (!row) return;
      // ⌘/Ctrl + Enter adds without leaving the palette.
      if ((event.metaKey || event.ctrlKey) && !row.entry) add(row.anime, 'planned');
      else openDetail(row.anime);
    }
  };

  const showEmpty = !loading && query.trim().length >= 2 && rows.length === 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh] sm:pt-[14vh]">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Recherche"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.15 } }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={onKeyDown}
            className="glass relative flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-panel border border-line shadow-pop"
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
              {loading ? (
                <Loader2 size={18} className="shrink-0 animate-spin text-brand-bright" />
              ) : (
                <Search size={18} className="shrink-0 text-ink-faint" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un anime, ou dans ta watchlist…"
                aria-label="Rechercher un anime"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:block">
                Esc
              </kbd>
            </div>

            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
              {tooShort && (
                <p className="px-4 py-8 text-center text-xs text-ink-faint">
                  Tape au moins 2 caractères.
                </p>
              )}

              {error && (
                <p className="px-4 py-8 text-center text-xs text-danger" role="alert">
                  {error}
                </p>
              )}

              {showEmpty && !error && (
                <p className="px-4 py-10 text-center text-sm text-ink-dim">
                  Aucun résultat pour «&nbsp;{query.trim()}&nbsp;».
                </p>
              )}

              {rows.length > 0 && (
                <ul ref={listRef} className="p-2">
                  {rows.map((row, index) => {
                    const previous = rows[index - 1];
                    const showHeader = !previous || previous.group !== row.group;
                    return (
                      <li key={`${row.group}-${row.anime.id}`}>
                        {showHeader && (
                          <p className="flex items-center gap-1.5 px-2 pt-3 pb-1.5 text-[10px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                            {row.group === 'library' ? (
                              <>
                                <Star size={10} />
                                {query.trim().length < 2 ? 'Reprendre' : 'Dans ma watchlist'}
                              </>
                            ) : (
                              <>
                                <TrendingUp size={10} /> Catalogue AniList
                              </>
                            )}
                          </p>
                        )}
                        <ResultRow
                          row={row}
                          active={index === active}
                          titleLanguage={settings.titleLanguage}
                          onHover={() => setActive(index)}
                          onOpen={() => openDetail(row.anime)}
                          onAdd={() => add(row.anime, 'planned')}
                          onMarkWatched={() => add(row.anime, 'completed')}
                          inLibrary={isInLibrary(row.anime.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[10px] text-ink-faint sm:flex">
              <span className="flex items-center gap-1">
                <Key>↑</Key>
                <Key>↓</Key> naviguer
              </span>
              <span className="flex items-center gap-1">
                <Key>
                  <CornerDownLeft size={9} />
                </Key>
                ouvrir
              </span>
              <span className="flex items-center gap-1">
                <Key>Ctrl</Key>
                <Key>
                  <CornerDownLeft size={9} />
                </Key>
                ajouter
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-line bg-surface-2 px-1 font-sans text-[9px] text-ink-dim">
      {children}
    </kbd>
  );
}

function ResultRow({
  row,
  active,
  titleLanguage,
  inLibrary,
  onHover,
  onOpen,
  onAdd,
  onMarkWatched,
}: {
  row: Row;
  active: boolean;
  titleLanguage: 'romaji' | 'english';
  inLibrary: boolean;
  onHover: () => void;
  onOpen: () => void;
  onAdd: () => void;
  onMarkWatched: () => void;
}) {
  const { anime, entry } = row;
  const score = communityScore(anime.averageScore);

  const meta = [
    anime.year,
    anime.format ? (FORMAT_LABEL[anime.format] ?? anime.format) : null,
    anime.episodes ? `${anime.episodes} ép.` : null,
    score ? `★ ${score}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onMouseMove={onHover}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150',
        active && 'bg-surface-2',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <Poster
          src={anime.poster}
          alt=""
          tint={anime.color}
          className="w-9 shrink-0 rounded-md"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {displayTitle(anime, titleLanguage)}
            </span>
            {entry?.rating != null && <MyRating value={entry.rating} size="sm" />}
            {entry && <StatusBadge status={entry.status} />}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{meta}</span>
        </span>
      </button>

      {inLibrary ? (
        <span className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-st-completed">
          <Check size={12} /> <span className="hidden sm:inline">Déjà dans ma liste</span>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onAdd}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[11px] font-medium text-ink transition-colors duration-200 hover:border-brand/40 hover:bg-brand/15"
          >
            <Plus size={12} /> <span className="hidden sm:inline">Ajouter</span>
          </button>
          {/* For series already finished before using the app. */}
          <button
            type="button"
            onClick={onMarkWatched}
            aria-label="Marquer comme déjà regardé"
            title="Marquer comme déjà regardé"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-dim transition-colors duration-200 hover:border-st-completed/40 hover:text-st-completed"
          >
            <Check size={13} />
          </button>
        </span>
      )}
    </div>
  );
}
