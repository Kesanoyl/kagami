import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLibrary } from '@/store/LibraryContext';
import { relativeTime } from '@/lib/format';

const KIND_TONE: Record<string, string> = {
  'new-episode': 'bg-st-watching',
  'airing-soon': 'bg-st-planned',
  finished: 'bg-st-completed',
};

/**
 * Reads the locally-derived reminder feed. The same panel will render
 * server-pushed notifications unchanged once a backend exists.
 */
export function NotificationBell() {
  const { notifications, markNotificationsRead } = useLibrary();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpen((current) => {
      if (!current && unread > 0) markNotificationsRead();
      return !current;
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-dim transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.13 } }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute top-[calc(100%+8px)] right-0 z-50 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border border-line shadow-pop"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Notifications</p>
            </div>

            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-9 text-center">
                <BellOff size={20} className="text-ink-faint" />
                <p className="text-xs text-ink-dim">
                  Rien pour le moment. Les nouveaux épisodes de tes séries en cours apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul className="scroll-slim max-h-80 divide-y divide-line overflow-y-auto">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/anime/${item.animeId}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface-2"
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          KIND_TONE[item.kind] ?? 'bg-ink-faint',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-ink">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-dim">{item.body}</span>
                        <span className="mt-1 block text-[10px] text-ink-faint">
                          {relativeTime(item.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
