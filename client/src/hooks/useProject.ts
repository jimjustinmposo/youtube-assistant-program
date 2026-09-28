import { useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { Project } from '../types/project';

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    api
      .getProject(id)
      .then((result) => {
        if (!cancelled) setProject(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause : new ApiError('Failed to load project.', 0, 'UNKNOWN_ERROR'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { project, isLoading, error };
}
