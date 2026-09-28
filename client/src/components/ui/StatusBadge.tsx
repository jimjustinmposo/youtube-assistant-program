import type { ProjectStatus } from '../../types/project';

const STYLES: Record<ProjectStatus, string> = {
  draft: 'bg-zinc-800 text-zinc-300 ring-zinc-700',
  uploading: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  ready: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  failed: 'bg-red-500/15 text-red-300 ring-red-500/40',
};

const LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  uploading: 'Uploading',
  ready: 'Ready',
  failed: 'Failed',
};

export function StatusBadge({ status, className = '' }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
