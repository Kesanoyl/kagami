import { Link } from 'react-router-dom';
import { RefreshCw, Search, Settings } from 'lucide-react';
import { Logo } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useWatchlist } from '@/hooks/useWatchlist';
import { cn } from '@/lib/cn';

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { refreshing } = useWatchlist();
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="glass sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex h-16 max-w-[112rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="Kagami — accueil">
          <Logo size={26} />
          <span className="font-display text-sm font-semibold tracking-tight text-ink">Kagami</span>
        </Link>

        {/* Desktop: a real search field that opens the palette. */}
        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            'ml-auto hidden h-10 w-full max-w-md cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface/70 px-3.5',
            'text-sm text-ink-faint transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface lg:ml-0 lg:flex',
          )}
        >
          <Search size={16} />
          <span className="flex-1 text-left">Rechercher un anime…</span>
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-faint">
            {isApple ? '⌘' : 'Ctrl'} K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          {refreshing && (
            <span
              className="mr-1 hidden items-center gap-1.5 text-[11px] text-ink-faint sm:flex"
              role="status"
            >
              <RefreshCw size={12} className="animate-spin" />
              Synchronisation
            </span>
          )}

          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Rechercher"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-dim transition-colors duration-200 hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Search size={18} />
          </button>

          <NotificationBell />

          <Link
            to="/settings"
            aria-label="Paramètres"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-dim transition-colors duration-200 hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
