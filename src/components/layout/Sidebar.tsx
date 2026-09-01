import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/ui/Tooltip';
import { useWatchlist } from '@/hooks/useWatchlist';
import { INSIGHT_NAV, PRIMARY_NAV, STATUS_NAV, type NavItem } from './navigation';
import { STATUS_DOT } from '@/components/ui/Badge';
import type { WatchStatus } from '@/types';

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { counts, entries } = useWatchlist();

  const countFor = (item: NavItem): number | null => {
    if (!item.count) return null;
    return item.count === 'all' ? entries.length : counts[item.count as WatchStatus];
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-canvas-soft lg:flex',
        'transition-[width] duration-250 ease-[var(--ease-out-soft)]',
        collapsed ? 'w-[4.5rem]' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-2' : 'justify-between pr-2 pl-5',
        )}
      >
        {!collapsed && (
          <NavLink to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight text-ink">
                Kagami
              </span>
              <span
                className="mt-0.5 text-[9px] tracking-[0.3em] text-ink-faint"
                style={{ fontFamily: 'var(--font-jp)' }}
                aria-hidden
              >
                鏡
              </span>
            </span>
          </NavLink>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <nav className="scroll-slim flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <NavGroup items={PRIMARY_NAV} collapsed={collapsed} countFor={countFor} />

        <NavGroup
          title="Par statut"
          items={STATUS_NAV}
          collapsed={collapsed}
          countFor={countFor}
          withDot
        />

        <NavGroup title="Analyse" items={INSIGHT_NAV} collapsed={collapsed} countFor={countFor} />
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <NavRow
          item={{ to: '/settings', label: 'Paramètres', icon: Settings }}
          collapsed={collapsed}
          count={null}
        />
      </div>
    </aside>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-violet text-white shadow-soft"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Sparkles size={size * 0.55} strokeWidth={2.2} />
    </span>
  );
}

function NavGroup({
  title,
  items,
  collapsed,
  countFor,
  withDot = false,
}: {
  title?: string;
  items: NavItem[];
  collapsed: boolean;
  countFor: (item: NavItem) => number | null;
  withDot?: boolean;
}) {
  return (
    <div>
      {title && !collapsed && (
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavRow
              item={item}
              collapsed={collapsed}
              count={countFor(item)}
              dot={withDot ? statusFromRoute(item.to) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusFromRoute(route: string): WatchStatus | undefined {
  const slug = route.split('/').pop();
  return slug && slug in STATUS_DOT ? (slug as WatchStatus) : undefined;
}

function NavRow({
  item,
  collapsed,
  count,
  dot,
}: {
  item: NavItem;
  collapsed: boolean;
  count: number | null;
  dot?: WatchStatus;
}) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center rounded-lg text-sm font-medium',
          'transition-[background-color,color] duration-200',
          collapsed ? 'w-11 justify-center' : 'gap-3 px-3',
          isActive
            ? 'bg-surface-2 text-ink'
            : 'text-ink-dim hover:bg-surface-2/60 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active marker is a shape, not just a colour. */}
          <span
            className={cn(
              'absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-bright transition-opacity duration-200',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
          {dot ? (
            <span className="relative flex h-[18px] w-[18px] items-center justify-center">
              <Icon size={17} strokeWidth={1.9} className="shrink-0" />
              <span
                className={cn(
                  'absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-full',
                  STATUS_DOT[dot],
                )}
                aria-hidden
              />
            </span>
          ) : (
            <Icon size={17} strokeWidth={1.9} className="shrink-0" />
          )}

          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

          {!collapsed && count !== null && count > 0 && (
            <span className="tnum shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-ink-dim">
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  // Collapsed rows are icon-only, so the label moves into a tooltip + aria-label.
  return collapsed ? (
    <Tooltip label={item.label}>{link}</Tooltip>
  ) : (
    link
  );
}
