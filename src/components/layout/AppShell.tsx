import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/search/CommandPalette';
import { useLibrary } from '@/store/LibraryContext';

export function AppShell() {
  const { settings, updateSettings } = useLibrary();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigationType = useNavigationType();

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  // ⌘K / Ctrl+K anywhere, and "/" when not already typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Fresh navigations start at the top; going back keeps the browser's position.
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, navigationType]);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar
        collapsed={settings.sidebarCollapsed}
        onToggle={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSearch={openPalette} />

        <main
          id="main"
          className="mx-auto w-full max-w-[112rem] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-14"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
