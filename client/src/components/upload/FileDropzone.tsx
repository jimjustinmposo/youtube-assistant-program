import { useEffect, useState } from 'react';
import { validateFile } from '../../lib/validation';
import type { FileRule } from '../../lib/validation';

interface FileDropzoneProps {
  id: string;
  label: string;
  hint: string;
  accept: string;
  rule: FileRule;
  file: File | null;
  disabled?: boolean;
  error: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  children: React.ReactNode;
}

/**
 * Drag & drop + file picker. The browser value is reset on every change so
 * re-selecting the same file still fires a change event.
 */
export function FileDropzone({
  id,
  label,
  hint,
  accept,
  rule,
  file,
  disabled,
  error,
  onSelect,
  onClear,
  children,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const message = error ?? localError;

  const handleFiles = (files: FileList | null) => {
    const candidate = files?.[0];
    if (!candidate) return;
    const problem = validateFile(candidate, rule);
    setLocalError(problem);
    if (!problem) onSelect(candidate);
  };

  useEffect(() => {
    setLocalError(null);
  }, [file]);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-zinc-200">
          {label}
        </label>
        <span className="text-xs text-zinc-500">Max {formatRuleMax(rule)}</span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-4 transition-colors ${
          isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-900/40'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {file ? (
          <div className="space-y-3">
            {children}
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={id}
                className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 focus-ring"
              >
                Replace
              </label>
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-ring"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-zinc-400">
              Drag &amp; drop your {label.toLowerCase()} here, or
            </p>
            <label
              htmlFor={id}
              className="cursor-pointer rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400 focus-ring"
            >
              Choose file
            </label>
            <p className="text-xs text-zinc-500">
              {hint} · up to {formatRuleMax(rule)}
            </p>
          </div>
        )}

        <input
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {message && <p className="text-sm text-red-400">{message}</p>}
    </div>
  );
}

function formatRuleMax(rule: FileRule): string {
  const megabytes = rule.maxBytes / (1024 * 1024);
  return `${Math.round(megabytes * 10) / 10} MB`;
}
