import { formatBytes } from '../../lib/format';

export function ProgressBar({
  percent,
  label,
  detail,
}: {
  percent: number;
  label: string;
  detail?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="tabular-nums">
          {clamped}%{detail ? ` · ${detail}` : ''}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function UploadedBytes({ loaded, total }: { loaded: number; total: number }) {
  return (
    <span className="tabular-nums">
      {formatBytes(loaded)} / {formatBytes(total)}
    </span>
  );
}
