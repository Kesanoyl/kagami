import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Statistics } from '@/hooks/useStatistics';
import { CHART_HEX, STATUS_HEX } from '@/lib/constants';
import { cn } from '@/lib/cn';

/**
 * Minimal, high-contrast charts. Recharts cannot read CSS variables, so the
 * palette is mirrored as hex in `lib/constants`.
 */

const AXIS = { stroke: '#6b6b7b', fontSize: 11 };
const GRID = '#23232e';

function ChartCard({
  title,
  subtitle,
  children,
  className,
  summary,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** Text alternative announced to screen readers instead of the SVG. */
  summary: string;
}) {
  return (
    <section className={cn('rounded-panel border border-line bg-surface/50 p-5', className)}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {subtitle && <p className="mt-0.5 mb-4 text-xs text-ink-dim">{subtitle}</p>}
      <p className="sr-only">{summary}</p>
      <div aria-hidden>{children}</div>
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = (item.payload?.label as string) ?? item.name ?? label;

  return (
    <div className="glass rounded-lg border border-line px-3 py-2 shadow-lift">
      <p className="text-xs font-medium text-ink">{name}</p>
      <p className="tnum text-xs text-ink-dim">
        {item.value} {unit}
      </p>
    </div>
  );
}

export default function StatsCharts({ stats }: { stats: Statistics }) {
  const hasMonthly = stats.monthly.some((point) => point.episodes > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Épisodes par mois"
        subtitle="Les 12 derniers mois"
        className="lg:col-span-2"
        summary={
          hasMonthly
            ? `Épisodes vus par mois : ${stats.monthly
                .map((point) => `${point.label} ${point.episodes}`)
                .join(', ')}.`
            : 'Aucun épisode enregistré sur les 12 derniers mois.'
        }
      >
        {hasMonthly ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.monthly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={AXIS} />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS}
                width={36}
              />
              <Tooltip
                cursor={{ fill: '#ffffff08' }}
                content={<ChartTooltip unit="épisodes" />}
              />
              <Bar dataKey="episodes" radius={[4, 4, 0, 0]} fill={CHART_HEX[0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Enregistre ta progression pour voir ton rythme apparaître ici." />
        )}
      </ChartCard>

      <ChartCard
        title="Répartition des statuts"
        subtitle="Où en sont tes séries"
        summary={stats.statusDistribution
          .map((point) => `${point.label} : ${point.count}`)
          .join(', ')}
      >
        {stats.statusDistribution.length > 0 ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={180} className="max-w-[180px]">
              <PieChart>
                <Pie
                  data={stats.statusDistribution}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={2}
                  stroke="none"
                >
                  {stats.statusDistribution.map((point) => (
                    <Cell key={point.status} fill={STATUS_HEX[point.status]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip unit="séries" />} />
              </PieChart>
            </ResponsiveContainer>

            {/* The legend carries the numbers so the chart never stands alone. */}
            <ul className="w-full flex-1 space-y-1.5">
              {stats.statusDistribution.map((point) => (
                <li key={point.status} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_HEX[point.status] }}
                  />
                  <span className="flex-1 text-ink-dim">{point.label}</span>
                  <span className="tnum font-medium text-ink">{point.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyChart message="Aucune série classée pour l’instant." />
        )}
      </ChartCard>

      <ChartCard
        title="Genres préférés"
        subtitle="Parmi les séries commencées"
        summary={
          stats.topGenres.length > 0
            ? stats.topGenres.map((point) => `${point.genre} : ${point.count}`).join(', ')
            : 'Aucun genre à afficher.'
        }
      >
        {stats.topGenres.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, stats.topGenres.length * 26)}>
            <BarChart
              data={stats.topGenres}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="genre"
                width={104}
                tickLine={false}
                axisLine={false}
                tick={AXIS}
              />
              <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip unit="séries" />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                {stats.topGenres.map((point, index) => (
                  <Cell key={point.genre} fill={CHART_HEX[index % CHART_HEX.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Commence une série pour voir tes genres favoris." />
        )}
      </ChartCard>

      <ChartCard
        title="Tes notes"
        subtitle="Distribution de tes évaluations"
        className="lg:col-span-2"
        summary={
          stats.ratedCount > 0
            ? stats.ratingDistribution
                .filter((point) => point.count > 0)
                .map((point) => `${point.bucket}/10 : ${point.count}`)
                .join(', ')
            : 'Aucune note enregistrée.'
        }
      >
        {stats.ratedCount > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={stats.ratingDistribution}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: GRID }} tick={AXIS} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} width={36} />
              <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip unit="séries" />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={CHART_HEX[1]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Note tes séries terminées pour voir apparaître ta distribution." />
        )}
      </ChartCard>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line px-6 text-center">
      <p className="text-xs text-ink-dim">{message}</p>
    </div>
  );
}
