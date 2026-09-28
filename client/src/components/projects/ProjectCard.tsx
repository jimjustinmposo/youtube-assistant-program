import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { api } from '../../lib/api';
import { formatBytes, formatDate } from '../../lib/format';
import type { Project } from '../../types/project';

export function ProjectCard({ project }: { project: Project }) {
  const title = project.originalFilename ?? project.video.originalFilename ?? 'Untitled project';
  const hasThumbnail = project.thumbnail.storageKey !== null;

  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-zinc-700">
      <Link
        to={`/projects/${project.id}`}
        className="group relative block aspect-video overflow-hidden bg-zinc-950 focus-ring"
      >
        {hasThumbnail ? (
          <img
            src={api.thumbnailUrl(project.id)}
            alt={`Thumbnail for ${title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            No thumbnail
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={project.status} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100" title={title}>
            {title}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {formatBytes(project.video.sizeBytes)} · updated {formatDate(project.updatedAt)}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span>Created {formatDate(project.createdAt)}</span>
          <Link
            to={`/projects/${project.id}`}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-medium text-zinc-100 transition-colors hover:bg-zinc-700 focus-ring"
          >
            Open
          </Link>
        </div>
      </div>
    </Card>
  );
}
