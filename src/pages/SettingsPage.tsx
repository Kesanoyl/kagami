import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  Bell,
  Database,
  Download,
  FileJson,
  HardDrive,
  History,
  Info,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLibrary } from '@/store/LibraryContext';
import { useToast } from '@/store/ToastContext';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageTitle } from '@/components/ui/SectionHeader';
import { AniListImport } from '@/components/settings/AniListImport';
import { Select, Toggle } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import {
  buildBackup,
  downloadBackup,
  InvalidBackupError,
  parseBackup,
  previewImport,
  type ParsedBackup,
} from '@/services/storage/backup';
import { clearApiCache } from '@/services/api/client';
import {
  formatBytes,
  requestPersistentStorage,
  type StorageStatus,
} from '@/services/storage/durability';
import { chooseBackupFile, isFileBackupSupported } from '@/services/storage/fileBackup';
import { listSnapshots, type Snapshot } from '@/services/storage/snapshots';
import type { ImportPreview } from '@/types';
import { formatNumber, relativeTime } from '@/lib/format';

export default function SettingsPage() {
  const library = useLibrary();
  const { entries } = useWatchlist();
  const toast = useToast();

  const [pending, setPending] = useState<{ parsed: ParsedBackup; preview: ImportPreview } | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const backup = buildBackup(entries, [...library.animes.values()], library.settings);
    downloadBackup(backup);
    toast({
      title: 'Sauvegarde exportée',
      description: `${backup.entries.length} série(s) dans le fichier.`,
      variant: 'success',
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      setPending({ parsed, preview: previewImport(parsed, entries) });
    } catch (error) {
      toast({
        title: 'Import impossible',
        description:
          error instanceof InvalidBackupError
            ? error.message
            : 'Le fichier n’a pas pu être lu.',
        variant: 'error',
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    const { parsed } = pending;

    // Imported entries win on conflict; untouched local entries are preserved.
    const merged = new Map(entries.map((entry) => [entry.animeId, entry]));
    for (const entry of parsed.entries) merged.set(entry.animeId, entry);

    library.replaceAll([...merged.values()], parsed.animes, parsed.settings);
    setPending(null);
    toast({
      title: 'Import réussi',
      description: `${parsed.entries.length} série(s) importée(s).`,
      variant: 'success',
    });
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="max-w-3xl space-y-10">
      <PageTitle
        kicker="設定"
        title="Paramètres"
        subtitle="Tes données restent sur cet appareil. Exporte-les pour les transférer ailleurs."
      />

      <Card title="Affichage" icon={<Info size={15} />}>
        <div className="max-w-xs">
          <Select
            label="Langue des titres"
            value={library.settings.titleLanguage}
            onChange={(event) =>
              library.updateSettings({
                titleLanguage: event.target.value as 'romaji' | 'english',
              })
            }
          >
            <option value="romaji">Romaji (Shingeki no Kyojin)</option>
            <option value="english">Anglais (Attack on Titan)</option>
          </Select>
        </div>

        <div className="mt-2 divide-y divide-line">
          <Toggle
            label="Terminer automatiquement"
            description="Passer une série en « Terminé » dès le dernier épisode atteint."
            checked={library.settings.autoComplete}
            onChange={(autoComplete) => library.updateSettings({ autoComplete })}
          />
          <Toggle
            label="Contenu adulte"
            description="Inclure les titres classés adultes dans la recherche et la découverte."
            checked={library.settings.adultContent}
            onChange={(adultContent) => {
              library.updateSettings({ adultContent });
              // Cached responses were filtered with the previous setting.
              clearApiCache();
            }}
          />
        </div>
      </Card>

      <Card
        title="Rappels"
        icon={<Bell size={15} />}
        description="Calculés localement à partir des dates de diffusion. Ils apparaissent dans la cloche en haut de l’écran."
      >
        <div className="divide-y divide-line">
          <Toggle
            label="Nouvel épisode disponible"
            description="Quand un épisode est sorti et que tu ne l’as pas encore marqué."
            checked={library.settings.reminders.newEpisode}
            onChange={(newEpisode) =>
              library.updateSettings({
                reminders: { ...library.settings.reminders, newEpisode },
              })
            }
          />
          <Toggle
            label="Diffusion imminente"
            description="Un rappel dans les 24 h précédant un nouvel épisode."
            checked={library.settings.reminders.airingSoon}
            onChange={(airingSoon) =>
              library.updateSettings({
                reminders: { ...library.settings.reminders, airingSoon },
              })
            }
          />
          <Toggle
            label="Série terminée"
            description="Quand une série que tu regardes a fini sa diffusion."
            checked={library.settings.reminders.seriesFinished}
            onChange={(seriesFinished) =>
              library.updateSettings({
                reminders: { ...library.settings.reminders, seriesFinished },
              })
            }
          />
        </div>
      </Card>

      <Card title="Mes données" icon={<Database size={15} />}>
        <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Séries suivies" value={formatNumber(entries.length)} />
          <Stat label="Fiches en cache" value={formatNumber(library.animes.size)} />
          <Stat
            label="Notes écrites"
            value={formatNumber(entries.filter((entry) => entry.notes.trim().length > 0).length)}
          />
        </dl>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-ink">Exporter</h3>
            <p className="mt-0.5 mb-3 text-xs text-ink-dim">
              Un fichier JSON avec ta watchlist, ta progression, tes notes et tes préférences.
            </p>
            <Button variant="secondary" onClick={handleExport} disabled={entries.length === 0}>
              <Download size={15} /> Télécharger ma sauvegarde
            </Button>
          </div>

          <AniListImport />

          <div>
            <h3 className="text-sm font-medium text-ink">Importer une sauvegarde Kagami</h3>
            <p className="mt-0.5 mb-3 text-xs text-ink-dim">
              Un aperçu s’affiche avant toute modification.
            </p>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border border-dashed px-6 py-9 text-center',
                'transition-[border-color,background-color] duration-200',
                dragging
                  ? 'border-brand bg-brand/8'
                  : 'border-line hover:border-line-strong hover:bg-surface/50',
              )}
            >
              <Upload size={20} className="text-ink-faint" />
              <span className="text-sm text-ink">
                Dépose ton fichier ici ou <span className="text-brand-bright">parcours</span>
              </span>
              <span className="text-[11px] text-ink-faint">Format JSON exporté par Kagami</span>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      </Card>

      <DurabilityCard />

      <Card
        title="Zone sensible"
        icon={<Trash2 size={15} />}
        description="Cette action efface définitivement ta watchlist sur cet appareil."
        tone="danger"
      >
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          <Trash2 size={15} /> Effacer toutes mes données
        </Button>
      </Card>

      <p className="pt-2 text-center text-[11px] text-ink-faint">
        Kagami · données du catalogue fournies par AniList
      </p>

      {/* ------------------------------------------------------ import preview */}
      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Aperçu de l’import"
        description="Rien n’est modifié tant que tu n’as pas confirmé."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={confirmImport}>
              Importer
            </Button>
          </>
        }
      >
        {pending && (
          <ul className="space-y-2 text-sm">
            <PreviewRow
              label="Séries dans le fichier"
              value={pending.preview.totalEntries}
              tone="neutral"
            />
            <PreviewRow label="Nouvelles séries" value={pending.preview.newEntries} tone="success" />
            <PreviewRow
              label="Séries mises à jour"
              value={pending.preview.updatedEntries}
              tone="brand"
            />
            <PreviewRow
              label="Inchangées"
              value={pending.preview.unchangedEntries}
              tone="neutral"
            />
            {pending.preview.hasSettings && (
              <li className="flex items-center gap-2 pt-2 text-xs text-ink-dim">
                <FileJson size={13} /> Les préférences du fichier seront appliquées.
              </li>
            )}
          </ul>
        )}
      </Modal>

      {/* -------------------------------------------------------- reset confirm */}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Tout effacer ?"
        description="Cette action est irréversible."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                library.resetAll();
                setConfirmReset(false);
                toast({ title: 'Données effacées', variant: 'success' });
              }}
            >
              Effacer définitivement
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-dim">
          {entries.length > 0
            ? `${entries.length} série(s), leur progression, leurs notes et tes préférences seront supprimées.`
            : 'Aucune donnée à supprimer pour le moment.'}{' '}
          Pense à exporter une sauvegarde avant.
        </p>
      </Modal>
    </div>
  );
}

/**
 * Everything protecting the watchlist from disappearing, in one place:
 * eviction-proof storage, a rolling history of restore points, and a live
 * mirror of the data into a real file on disk.
 */
function DurabilityCard() {
  const { entries, backupFileName, lastBackupAt, refreshBackupTarget, backupNow, restoreSnapshot } =
    useLibrary();
  const toast = useToast();

  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => listSnapshots());
  const [pendingRestore, setPendingRestore] = useState<Snapshot | null>(null);
  const supported = isFileBackupSupported();

  useEffect(() => {
    void requestPersistentStorage().then(setStatus);
  }, []);

  // Re-read after any change to the watchlist — otherwise the restore point
  // created by an import or a reset would stay invisible until a page reload,
  // exactly when the user needs it most.
  useEffect(() => {
    setSnapshots(listSnapshots());
  }, [entries]);

  const connect = async () => {
    const name = await chooseBackupFile();
    if (!name) return;
    await refreshBackupTarget();
    toast({
      title: 'Sauvegarde automatique activée',
      description: `Chaque modification sera écrite dans ${name}.`,
      variant: 'success',
    });
  };

  return (
    <Card
      title="Ne jamais rien perdre"
      icon={<ShieldCheck size={15} />}
      description="Trois protections indépendantes : le navigateur ne peut pas effacer les données, un historique de restauration est conservé, et tout peut être recopié en continu dans un fichier."
    >
      <div className="space-y-5">
        {/* 1 — eviction-proof storage */}
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface/60 p-3.5">
          <HardDrive size={15} className="mt-0.5 shrink-0 text-ink-faint" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Stockage protégé</p>
            <p className="mt-0.5 text-xs text-ink-dim">
              {status?.persisted
                ? 'Le navigateur s’est engagé à ne pas effacer tes données automatiquement.'
                : status?.supported === false
                  ? 'Ton navigateur ne propose pas cette garantie.'
                  : 'Protection demandée — elle s’active dès que le navigateur te considère comme un utilisateur régulier.'}
            </p>
            {status?.usage != null && (
              <p className="mt-1 text-[11px] text-ink-faint">
                {formatBytes(status.usage)} utilisés
                {status.quota ? ` sur ${formatBytes(status.quota)} disponibles` : ''}
              </p>
            )}
          </div>
          <span
            className={cn(
              'mt-1 h-2 w-2 shrink-0 rounded-full',
              status?.persisted ? 'bg-st-completed' : 'bg-warning',
            )}
            aria-hidden
          />
        </div>

        {/* 2 — continuous mirror to a real file */}
        <div className="rounded-xl border border-line bg-surface/60 p-3.5">
          <div className="flex items-start gap-3">
            <FileJson size={15} className="mt-0.5 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Copie continue vers un fichier</p>
              <p className="mt-0.5 text-xs text-ink-dim">
                {!supported
                  ? 'Non disponible dans ce navigateur — utilise l’export manuel ci-dessus. (Chrome et Edge le supportent.)'
                  : backupFileName
                    ? `Chaque modification est écrite dans « ${backupFileName} ».`
                    : 'Choisis un fichier une seule fois : l’app y recopiera ta watchlist à chaque changement, même après un effacement du navigateur.'}
              </p>
              {backupFileName && (
                <p className="mt-1 text-[11px] text-ink-faint">
                  {lastBackupAt
                    ? `Dernière écriture ${relativeTime(lastBackupAt)}`
                    : 'En attente de la première modification'}
                </p>
              )}
            </div>
          </div>

          {supported && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={backupFileName ? 'secondary' : 'primary'} size="sm" onClick={connect}>
                <FileJson size={14} /> {backupFileName ? 'Changer de fichier' : 'Choisir un fichier'}
              </Button>
              {backupFileName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await backupNow();
                    toast({
                      title: ok ? 'Fichier mis à jour' : 'Écriture impossible',
                      description: ok ? backupFileName : 'Autorise à nouveau l’accès au fichier.',
                      variant: ok ? 'success' : 'error',
                    });
                    if (!ok) await refreshBackupTarget();
                  }}
                >
                  Écrire maintenant
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 3 — restore points */}
        <div className="rounded-xl border border-line bg-surface/60 p-3.5">
          <div className="flex items-start gap-3">
            <History size={15} className="mt-0.5 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Points de restauration</p>
              <p className="mt-0.5 text-xs text-ink-dim">
                Enregistrés automatiquement une fois par jour et avant chaque import ou
                effacement. Conservés même si tu effaces la watchlist.
              </p>
            </div>
          </div>

          {snapshots.length === 0 ? (
            <p className="mt-3 text-xs text-ink-faint">
              Aucun point pour l’instant — le premier sera pris à ta prochaine visite.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {snapshots.map((snapshot) => (
                <li
                  key={snapshot.at}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-ink">
                      {snapshot.entryCount} série{snapshot.entryCount > 1 ? 's' : ''}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {relativeTime(snapshot.at)} · {snapshot.reason}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingRestore(snapshot)}
                    className="shrink-0 cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-dim transition-colors duration-200 hover:border-line-strong hover:text-ink"
                  >
                    Restaurer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title="Restaurer ce point ?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRestore(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!pendingRestore) return;
                restoreSnapshot(pendingRestore.entries);
                setSnapshots(listSnapshots());
                setPendingRestore(null);
                toast({
                  title: 'Watchlist restaurée',
                  description: `${pendingRestore.entryCount} série(s) remises en place.`,
                  variant: 'success',
                });
              }}
            >
              Restaurer
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-dim">
          Ta watchlist actuelle ({entries.length} série{entries.length > 1 ? 's' : ''}) sera
          remplacée par celle de ce point ({pendingRestore?.entryCount ?? 0}). L’état actuel est
          lui-même sauvegardé comme nouveau point de restauration, donc l’opération reste
          réversible.
        </p>
      </Modal>
    </Card>
  );
}

function Card({
  title,
  description,
  icon,
  children,
  tone = 'default',
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={cn(
        'rounded-panel border p-5 sm:p-6',
        tone === 'danger' ? 'border-danger/25 bg-danger/4' : 'border-line bg-surface/40',
      )}
    >
      <h2
        className={cn(
          'flex items-center gap-2 text-sm font-semibold',
          tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {icon} {title}
      </h2>
      {description && <p className="mt-1 mb-4 text-xs text-ink-dim">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 px-3 py-2.5">
      <dt className="text-[11px] text-ink-dim">{label}</dt>
      <dd className="tnum mt-0.5 text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'brand';
}) {
  const tones = {
    neutral: 'text-ink',
    success: 'text-st-completed',
    brand: 'text-brand-bright',
  } as const;

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg bg-surface-2/60 px-3 py-2">
      <span className="text-xs text-ink-dim">{label}</span>
      <span className={cn('tnum text-sm font-semibold', tones[tone])}>{value}</span>
    </li>
  );
}
