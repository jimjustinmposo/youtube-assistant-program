import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, Spinner } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { ProjectGrid } from '../components/projects/ProjectGrid';
import { useProjects } from '../hooks/useProjects';

export function ProjectsPage() {
  const { projects, isLoading, error, reload } = useProjects();

  return (
    <>
      <PageHeader
        title="Projects"
        description="All local projects, newest first."
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

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-zinc-800 py-16 text-zinc-500">
            <Spinner className="h-6 w-6" />
            <span className="ml-3 text-sm">Loading projects…</span>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Projects you create will be listed here."
            action={
              <Link to="/new">
                <Button>Create a project</Button>
              </Link>
            }
          />
        ) : (
          <ProjectGrid projects={projects} />
        )}
      </div>
    </>
  );
}
