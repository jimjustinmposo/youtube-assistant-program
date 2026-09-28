import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { Project } from '../types/project';

export interface ProjectsState {
  projects: Project[];
  total: number;
  isLoading: boolean;
  error: ApiError | null;
  reload: () => void;
  remove: (id: string) => Promise<void>;
}

export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api
      .listProjects()
      .then((result) => {
        if (cancelled) return;
        setProjects(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof ApiError ? cause : new ApiError('Failed to load projects.', 0, 'UNKNOWN_ERROR'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const remove = useCallback(
    async (id: string) => {
      await api.deleteProject(id);
      setProjects((current) => current.filter((project) => project.id !== id));
      setTotal((current) => Math.max(0, current - 1));
    },
    [],
  );

  return { projects, total, isLoading, error, reload, remove };
}
