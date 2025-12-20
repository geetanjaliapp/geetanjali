import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * Displays a subtle banner when the user is offline.
 * Auto-hides when connectivity is restored.
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-amber-600 dark:bg-amber-700 text-white text-center py-2 px-4 text-sm font-medium shadow-md"
      role="alert"
      aria-live="assertive"
    >
      <span className="inline-flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-2.828 2.828a1 1 0 000 1.414m8.485-8.485l-14.142 14.142"
          />
        </svg>
        You're offline — some features may be unavailable
      </span>
    </div>
  );
}
