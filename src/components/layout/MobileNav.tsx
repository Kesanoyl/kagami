import { NavLink } from 'react-router-dom';
import { BarChart3, Compass, House, Library, Radio } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useWatchlist } from '@/hooks/useWatchlist';

/**
 * Purpose-built for touch — not a squeezed sidebar.
 * Five destinations max; settings live in the mobile top bar instead.
 */
const ITEMS = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/discover', label: 'Découvrir', icon: Compass, end: false },
  { to: '/library', label: 'Ma liste', icon: Library, end: false, badge: true },
  // Daily-value slot: what just aired beats what is scheduled. The calendar is
  // one tap away from this page.
  { to: '/releases', label: 'Sorties', icon: Radio, end: false },
  { to: '/stats', label: 'Stats', icon: BarChart3, end: false },
];

export function MobileNav() {
  const { counts } = useWatchlist();

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-50 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navigation principale"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium',
                    'transition-colors duration-200',
                    isActive ? 'text-ink' : 'text-ink-faint',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'absolute top-0 h-0.5 w-8 rounded-b-full bg-brand-bright transition-opacity duration-200',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="relative">
                      <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                      {item.badge && counts.watching > 0 && (
                        <span
                          className="absolute -top-0.5 -right-1.5 h-1.5 w-1.5 rounded-full bg-st-watching"
                          aria-hidden
                        />
                      )}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
