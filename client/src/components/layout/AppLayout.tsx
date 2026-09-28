import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApiHealth } from '../../hooks/useApiHealth';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Marks items that exist in the navigation but are not implemented yet. */
  placeholder?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <IconGrid /> },
  { to: '/new', label: 'New Video', icon: <IconUpload /> },
  { to: '/projects', label: 'Projects', icon: <IconFolder /> },
  { to: '/youtube', label: 'YouTube', icon: <IconPlay />, placeholder: true },
  { to: '/settings', label: 'Settings', icon: <IconCog /> },
];

export function AppLayout() {
  const { info, error, isLoading } = useApiHealth();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-zinc-800 bg-zinc-900/40 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col p-4">
          <div className="px-2 py-3">
            <p className="text-sm font-semibold tracking-tight text-zinc-50">YouTube Assistant</p>
            <p className="mt-0.5 text-xs text-zinc-500">Local content workspace</p>
          </div>

          <nav className="mt-2 flex flex-col gap-1 lg:mt-6">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-ring ${
                    isActive
                      ? 'bg-zinc-800 font-medium text-zinc-50'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                  }`
                }
              >
                <span className="text-zinc-500">{item.icon}</span>
                <span>{item.label}</span>
                {item.placeholder && (
                  <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                    Soon
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto hidden pt-6 lg:block">
            <BackendStatus isLoading={isLoading} error={error} phase={info?.phase} />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 lg:hidden">
            <BackendStatus isLoading={isLoading} error={error} phase={info?.phase} />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function BackendStatus({
  isLoading,
  error,
  phase,
}: {
  isLoading: boolean;
  error: { isBackendUnavailable: boolean } | null;
  phase?: string;
}) {
  const state = isLoading ? 'checking' : error ? 'offline' : 'online';
  const tone =
    state === 'online' ? 'text-emerald-400' : state === 'offline' ? 'text-red-400' : 'text-zinc-500';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-xs">
      <p className={`font-medium ${tone}`}>
        Backend {state === 'online' ? 'connected' : state === 'offline' ? 'unavailable' : 'checking…'}
      </p>
      <p className="mt-0.5 truncate text-zinc-500">{phase ?? 'Local development'}</p>
    </div>
  );
}

const iconClass = 'h-4 w-4';

function IconGrid() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16" strokeLinecap="round" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7.5A1.5 1.5 0 014.5 6h4l2 2.5h9A1.5 1.5 0 0121 10v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-10z" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10.5 9.5l4 2.5-4 2.5v-5z" strokeLinejoin="round" />
    </svg>
  );
}

function IconCog() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2M12 19.5v2M4.2 7l1.7 1M18.1 16l1.7 1M2.5 12h2M19.5 12h2M4.2 17l1.7-1M18.1 8l1.7-1" strokeLinecap="round" />
    </svg>
  );
}
