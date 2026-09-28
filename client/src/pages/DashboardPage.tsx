import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Button';
import { ProjectGrid } from '../components/projects/ProjectGrid';
import { useProjects } from '../hooks/useProjects';

const RECENT_LIMIT = 6;

export function DashboardPage() {
  const { projects, total, isLoading, error, reload } = useProjects();
  const ready = projects.filter((project) => project.status === 'ready').length;
  const recent = projects.slice(0, RECENT_LIMIT);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything stored on this computer. Uploads only — no analysis or publishing in this phase."
        action={
          <Link to="/new">
            <Button>New Video</Button>
          </Link>
        }
      />

      {error && (
        <Alert
          tone={error.isBackendUnavailable ? 'error' : 'warning'}
          title={error.isBackendUnavailable ? 'The local backend is not reachable' : 'Could not load projects'}
          action={
            <Button size="sm" variant="secondary" onClick={reload}>
              Retry
            </Button>
          }
        >
          {error.message}
        </Alert>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total projects" value={isLoading ? '—' : String(total)} />
        <StatCard label="On this page" value={isLoading ? '—' : String(projects.length)} />
        <StatCard label="Ready" value={isLoading ? '—' : String(ready)} />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">Recent projects</h2>
          {total > RECENT_LIMIT && (
            <Link to="/projects" className="text-sm text-indigo-400 hover:text-indigo-300">
              View all
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-zinc-800 py-16 text-zinc-500">
            <Spinner className="h-6 w-6" />
            <span className="ml-3 text-sm">Loading projects…</span>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project by uploading an exported MP4 and a YouTube thumbnail."
            action={
              <Link to="/new">
                <Button>Upload your first video</Button>
              </Link>
            }
          />
        ) : (
          <ProjectGrid projects={recent} />
        )}
      </section>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-zinc-50">{value}</p>
    </Card>
  );
}
