import { useEffect, useRef, useState } from 'react';
import { FileDropzone } from './FileDropzone';
import { formatBytes } from '../../lib/format';
import type { FileRule } from '../../lib/validation';

interface FileFieldProps {
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
}

export function VideoField(props: FileFieldProps) {
  const previewUrl = useObjectUrl(props.file);
  return (
    <FileDropzone {...props}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
          {previewUrl ? (
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              preload="metadata"
              className="max-h-72 w-full bg-black object-contain"
            />
          ) : null}
        </div>
        <FileSummary file={props.file} />
      </div>
    </FileDropzone>
  );
}

export function ThumbnailField(props: FileFieldProps) {
  const previewUrl = useObjectUrl(props.file);
  return (
    <FileDropzone {...props}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          {previewUrl ? (
            <img
              key={previewUrl}
              src={previewUrl}
              alt="Selected thumbnail preview"
              className="aspect-video w-full object-contain"
            />
          ) : null}
        </div>
        <FileSummary file={props.file} />
      </div>
    </FileDropzone>
  );
}

function FileSummary({ file }: { file: File | null }) {
  if (!file) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate text-zinc-200">{file.name}</span>
      <span className="shrink-0 text-xs text-zinc-500">{formatBytes(file.size)}</span>
    </div>
  );
}

/** Creates a local object URL and revokes it when the file changes. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current) URL.revokeObjectURL(previous.current);
    const next = file ? URL.createObjectURL(file) : null;
    previous.current = next;
    setUrl(next);
    return () => {
      if (next) URL.revokeObjectURL(next);
    };
  }, [file]);

  return url;
}
