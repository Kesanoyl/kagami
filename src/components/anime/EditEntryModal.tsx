import type { Anime, UserAnime } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { TrackingPanel } from './TrackingPanel';
import { useWatchlist } from '@/hooks/useWatchlist';
import { displayTitle } from '@/lib/format';

/** Quick-edit surface reachable from any card, without leaving the current page. */
export function EditEntryModal({
  anime,
  entry,
  open,
  onClose,
}: {
  anime: Anime;
  entry: UserAnime;
  open: boolean;
  onClose: () => void;
}) {
  const { settings } = useWatchlist();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={displayTitle(anime, settings.titleLanguage)}
      description="Modifications enregistrées automatiquement"
      size="md"
    >
      <TrackingPanel anime={anime} entry={entry} onRemoved={onClose} />
    </Modal>
  );
}
