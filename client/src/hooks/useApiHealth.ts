import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { FALLBACK_LIMITS } from '../lib/validation';
import type { HealthInfo, UploadLimits } from '../types/project';

export interface HealthState {
  info: HealthInfo | null;
  limits: UploadLimits;
  isLoading: boolean;
  error: ApiError | null;
}

/**
 * Loads backend health once at startup. The real upload limits are used for
 * client-side validation, with safe fallbacks if the backend is unreachable.
 */
export function useApiHealth(): HealthState & { refresh: () => void } {
  const [info, setInfo] = useState<HealthInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api
      .health()
      .then((result) => {
        if (cancelled) return;
        setInfo(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError('Unexpected error while contacting the backend.', 0, 'UNKNOWN_ERROR'),
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { info, limits: info?.limits ?? FALLBACK_LIMITS, isLoading, error, refresh };
}
