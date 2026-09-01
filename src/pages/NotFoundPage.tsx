import { Link } from 'react-router-dom';
import { Compass, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        className="border-none"
        icon={<SearchX size={22} />}
        title="Page introuvable"
        description="Ce lien ne mène nulle part. Retourne à l’accueil ou explore le catalogue."
        action={
          <div className="flex gap-2">
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-3"
            >
              Accueil
            </Link>
            <Link
              to="/discover"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-bright"
            >
              <Compass size={15} /> Découvrir
            </Link>
          </div>
        }
      />
    </div>
  );
}
