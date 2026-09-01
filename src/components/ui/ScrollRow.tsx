import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Horizontal rail used by every Discover / Home section.
 * Arrows appear on desktop only; touch devices just swipe with scroll-snap.
 */
export function ScrollRow({
  children,
  className,
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= 8);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [sync, children]);

  const scrollBy = (direction: 1 | -1) => {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={cn('group/row relative', className)}>
      <div
        ref={ref}
        onScroll={sync}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-1"
      >
        {children}
      </div>

      <RailButton
        side="left"
        hidden={atStart}
        onClick={() => scrollBy(-1)}
        className={itemClassName}
      />
      <RailButton side="right" hidden={atEnd} onClick={() => scrollBy(1)} className={itemClassName} />
    </div>
  );
}

function RailButton({
  side,
  hidden,
  onClick,
  className,
}: {
  side: 'left' | 'right';
  hidden: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Défiler vers la gauche' : 'Défiler vers la droite'}
      tabIndex={-1}
      className={cn(
        'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full',
        'glass border border-line text-ink shadow-lift',
        'opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 lg:flex',
        side === 'left' ? '-left-4' : '-right-4',
        hidden && 'pointer-events-none !opacity-0',
        className,
      )}
    >
      {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}
