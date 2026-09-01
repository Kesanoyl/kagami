import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Circle, Dot } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Poster } from '@/components/ui/Poster';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTitle } from '@/components/ui/SectionHeader';
import { Progress } from '@/components/ui/Progress';
import { MyRating } from '@/components/anime/Rating';
import { pendingEpisodes } from '@/lib/progress';
import { countdown, displayTitle, formatDay, formatShortDate, formatTime, progressPercent } from '@/lib/format';
import type { LibraryEntry } from '@/types';
import { cn } from '@/lib/cn';

interface ScheduledItem {
  entry: LibraryEntry;
  episode: number;
  airingAt: number;
}

const DAY_MS = 86_400_000;

export default function CalendarPage() {
  const { joined, settings, ready } = useWatchlist();

  const { available, days, later } = useMemo(() => {
    const tracked = joined.filter(
      (entry) => entry.user.status === 'watching' || entry.user.status === 'planned',
    );

    // Aired but unwatched — the red dots.
    const available = tracked
      .filter((entry) => pendingEpisodes(entry.user, entry.anime) > 0)
      .sort(
        (a, b) => pendingEpisodes(b.user, b.anime) - pendingEpisodes(a.user, a.anime),
      );

    const upcoming: ScheduledItem[] = tracked
      .filter((entry) => entry.anime.nextEpisode)
      .map((entry) => ({
        entry,
        episode: entry.anime.nextEpisode!.episode,
        airingAt: entry.anime.nextEpisode!.airingAt,
      }))
      .sort((a, b) => a.airingAt - b.airingAt);

    // Seven day buckets starting today, in local time.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const horizon = startOfToday.getTime() + 7 * DAY_MS;

    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(startOfToday.getTime() + offset * DAY_MS);
      const from = date.getTime();
      const to = from + DAY_MS;
      return {
        date,
        items: upcoming.filter(
          (item) => item.airingAt * 1000 >= from && item.airingAt * 1000 < to,
        ),
      };
    });

    const later = upcoming.filter((item) => item.airingAt * 1000 >= horizon);

    return { available, days, later };
  }, [joined]);

  const nothingScheduled =
    available.length === 0 && days.every((day) => day.items.length === 0) && later.length === 0;

  return (
    <div className="space-y-9">
      <PageTitle
        kicker="放送予定"
        title="Calendrier"
        subtitle="Les sorties des séries que tu suis, sur les 7 prochains jours."
      />

      {!ready ? null : nothingScheduled ? (
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="Aucune diffusion prévue"
          description="Ajoute une série en cours de diffusion à ta watchlist et son planning apparaîtra ici."
          action={
            <Link
              to="/discover"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
            >
              Voir ce qui est en diffusion
            </Link>
          }
        />
      ) : (
        <>
          {available.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
                Disponible maintenant
                <span className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-dim">
                  {available.length}
                </span>
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {available.map((entry) => (
                  <li key={entry.anime.id}>
                    <AvailableRow entry={entry} language={settings.titleLanguage} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Cette semaine</h2>
            <div className="space-y-1">
              {days.map(({ date, items }, index) => (
                <DayRow
                  key={date.toISOString()}
                  date={date}
                  items={items}
                  isToday={index === 0}
                  language={settings.titleLanguage}
                />
              ))}
            </div>
          </section>

          {later.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">Plus tard</h2>
              <ul className="space-y-1.5">
                {later.slice(0, 10).map((item) => (
                  <li key={item.entry.anime.id}>
                    <ScheduleRow item={item} language={settings.titleLanguage} showDate />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DayRow({
  date,
  items,
  isToday,
  language,
}: {
  date: Date;
  items: ScheduledItem[];
  isToday: boolean;
  language: 'romaji' | 'english';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3.5 transition-colors duration-200',
        isToday ? 'border-brand/30 bg-brand/6' : 'border-line bg-surface/40',
      )}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <h3
          className={cn(
            'text-xs font-semibold tracking-wide uppercase',
            isToday ? 'text-brand-bright' : 'text-ink',
          )}
        >
          {isToday ? "Aujourd'hui" : formatDay(date)}
        </h3>
        <span className="text-[11px] text-ink-faint">{formatShortDate(date)}</span>
      </div>

      {items.length === 0 ? (
        <p className="flex items-center gap-1 text-xs text-ink-faint">
          <Dot size={14} className="-ml-1" aria-hidden /> Rien de prévu
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.entry.anime.id}>
              <ScheduleRow item={item} language={language} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScheduleRow({
  item,
  language,
  showDate = false,
}: {
  item: ScheduledItem;
  language: 'romaji' | 'english';
  showDate?: boolean;
}) {
  const { entry, episode, airingAt } = item;
  const date = new Date(airingAt * 1000);

  return (
    <Link
      to={`/anime/${entry.anime.id}`}
      className="flex items-center gap-3 rounded-lg px-1 py-1.5 transition-colors duration-200 hover:bg-surface-2"
    >
      <Circle size={8} className="shrink-0 text-ink-faint" aria-hidden />
      <Poster
        src={entry.anime.poster}
        alt=""
        tint={entry.anime.color}
        className="w-8 shrink-0 rounded"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">
          {displayTitle(entry.anime, language)}
        </span>
        <span className="tnum block text-[11px] text-ink-faint">
          Épisode {episode}
          {showDate ? ` · ${formatShortDate(date)}` : ''} · {countdown(airingAt)}
        </span>
      </span>
      <span className="tnum shrink-0 text-xs font-medium text-ink-dim">{formatTime(date)}</span>
    </Link>
  );
}

function AvailableRow({
  entry: { user, anime },
  language,
}: {
  entry: LibraryEntry;
  language: 'romaji' | 'english';
}) {
  const pending = pendingEpisodes(user, anime);

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-2.5 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface"
    >
      <span className="relative shrink-0">
        <Poster src={anime.poster} alt="" tint={anime.color} className="w-10 rounded-md" />
        <span
          className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-danger"
          aria-hidden
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">
            {displayTitle(anime, language)}
          </span>
          {user.rating != null && <MyRating value={user.rating} size="sm" />}
        </span>
        <span className="tnum block text-[11px] text-ink-dim">
          {pending} épisode{pending > 1 ? 's' : ''} en attente · tu en es à l’ép.{' '}
          {user.currentEpisode}
        </span>
        <Progress value={progressPercent(user, anime)} className="mt-1.5 h-0.5" />
      </span>
    </Link>
  );
}
