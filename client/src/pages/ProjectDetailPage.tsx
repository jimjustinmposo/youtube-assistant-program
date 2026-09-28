import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button, Spinner } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useProject } from '../hooks/useProject';
import { useProjects } from '../hooks/useProjects';
import { ApiError, api } from '../lib/api';
import { formatBytes, formatDateTime } from '../lib/format';
import type { ProjectAsset } from '../types/project';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { project, isLoading, error } = useProject(id);
  const { remove } = useProjects();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const justCreated = searchParams.get('created') === '1';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Spinner className="h-6 w-6" />
        <span className="ml-3 text-sm">Loading project…</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <>
        <PageHeader title="Project" />
        <Alert
          tone={error?.isBackendUnavailable ? 'error' : 'warning'}
          title={error?.isBackendUnavailable ? 'The local backend is not reachable' : 'Project not found'}
        >
          {error?.message ?? 'This project does not exist.'}
        </Alert>
        <div className="mt-4">
          <Link to="/projects">
            <Button variant="secondary">Back to projects</Button>
          </Link>
        </div>
      </>
    );
  }

  const handleDelete = async () => {
    if (isDeleting) return;
    const confirmed = window.confirm(
      'Delete this project? The stored video, thumbnail and metadata are removed from this computer. This cannot be undone.',
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await remove(project.id);
      navigate('/projects');
    } catch (cause) {
      setDeleteError(cause instanceof ApiError ? cause.message : 'Failed to delete the project.');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={project.originalFilename ?? 'Untitled project'}
        description={`Project ${project.id}`}
        action={
          <div className="flex items-center gap-2">
            <Link to="/projects">
              <Button variant="secondary">Back</Button>
            </Link>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        }
      />

      {justCreated && (
        <div className="mb-6">
          <Alert tone="success" title="Project created">
            The video and thumbnail are stored locally. Status: {project.status}.
          </Alert>
        </div>
      )}

      {deleteError && (
        <div className="mb-6">
          <Alert tone="error" title="Delete failed">
            {deleteError}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Video"
              action={project.video.storageKey ? <StatusBadge status={project.status} /> : undefined}
            />
            <div className="p-5">
              {project.video.storageKey ? (
                <video
                  key={project.id}
                  src={api.videoUrl(project.id)}
                  controls
                  preload="metadata"
                  className="max-h-[70vh] w-full rounded-lg bg-black object-contain"
                />
              ) : (
                <p className="py-10 text-center text-sm text-zinc-500">No video stored for this project.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Thumbnail" />
            <div className="p-5">
              {project.thumbnail.storageKey ? (
                <img
                  src={api.thumbnailUrl(project.id)}
                  alt="Project thumbnail"
                  className="w-full max-w-md rounded-lg border border-zinc-800 object-contain"
                />
              ) : (
                <p className="py-10 text-center text-sm text-zinc-500">
                  No thumbnail stored for this project.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-zinc-800 text-sm">
              <Row label="Status" value={<StatusBadge status={project.status} />} />
              <Row label="Created" value={formatDateTime(project.createdAt)} />
              <Row label="Last updated" value={formatDateTime(project.updatedAt)} />
              <Row label="Video" value={<AssetValue asset={project.video} />} />
              <Row label="Thumbnail" value={<AssetValue asset={project.thumbnail} />} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Coming later" />
            <div className="space-y-2 p-5 text-sm text-zinc-400">
              <p>Video analysis, AI titles/hooks/descriptions and publishing are not implemented yet.</p>
              <p className="text-zinc-500">
                This project is stored locally. Nothing has been sent to YouTube or any external service.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-right text-zinc-200">{value}</dd>
    </div>
  );
}

function AssetValue({ asset }: { asset: ProjectAsset }) {
  if (!asset.storageKey) return <span className="text-zinc-500">Not uploaded</span>;
  return (
    <span className="block truncate">
      {asset.originalFilename}
      <span className="block text-xs text-zinc-500">
        {formatBytes(asset.sizeBytes)} · {asset.mimeType}
      </span>
    </span>
  );
}

}
