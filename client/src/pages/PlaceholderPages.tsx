import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { useApiHealth } from '../hooks/useApiHealth';
import { formatBytes } from '../lib/format';

export function YouTubePage() {
  return (
    <>
      <PageHeader
        title="YouTube"
        description="Composio handles the YouTube connection in a later phase."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Not available in this phase" />
          <div className="space-y-3 p-5 text-sm text-zinc-400">
            <p>
              This application does not connect to YouTube yet. No account is linked and nothing can be
              published.
            </p>
            <ul className="space-y-1.5 text-zinc-500">
              <li>• Phase 5 — Composio configuration and YouTube OAuth connection.</li>
              <li>• Phase 6 — Upload of approved projects, including the custom thumbnail.</li>
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="How it will work" />
          <div className="space-y-3 p-5 text-sm text-zinc-400">
            <p>
              Composio is used as the integration layer for authentication and uploads. The Composio API key
              is read only by the local backend and is never sent to the browser.
            </p>
            <Alert tone="info">
              A video is uploaded only after you explicitly approve it in the review step.
            </Alert>
          </div>
        </Card>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { info, limits, error, isLoading, refresh } = useApiHealth();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Local configuration, read from the running backend. Secrets are never displayed here."
        action={
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 transition-colors hover:bg-zinc-700 focus-ring"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-6">
          <Alert tone="error" title="The local backend is not reachable">
            {error.message}
          </Alert>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Application" />
          <dl className="divide-y divide-zinc-800 text-sm">
            <Row label="Name" value={info?.app ?? (isLoading ? 'Loading…' : '—')} />
            <Row label="Version" value={info?.version ?? '—'} />
            <Row label="Phase" value={info?.phase ?? '—'} />
            <Row label="Data directory" value={info?.storage.dataDir ?? '—'} mono />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Upload limits" />
          <dl className="divide-y divide-zinc-800 text-sm">
            <Row label="Max video size" value={formatBytes(limits.maxVideoSizeBytes)} />
            <Row label="Video formats" value={limits.videoExtensions.join(', ')} />
            <Row label="Max thumbnail size" value={formatBytes(limits.maxThumbnailSizeBytes)} />
            <Row label="Thumbnail formats" value={limits.thumbnailExtensions.join(', ')} />
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Change limits" description="Configured through the .env file in the project root." />
        <div className="p-5 text-sm text-zinc-400">
          <p>
            Set <code className="font-mono text-zinc-300">MAX_VIDEO_SIZE_MB</code> and{' '}
            <code className="font-mono text-zinc-300">MAX_THUMBNAIL_SIZE_MB</code> in{' '}
            <code className="font-mono text-zinc-300">.env</code>, then restart the backend. The values above
            come from the running server, not from the browser.
          </p>
        </div>
      </Card>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-zinc-200 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
