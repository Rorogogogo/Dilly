import '@src/NewTab.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { dillyStorage } from '@extension/storage';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState } from 'react';

const NewTab = () => {
  const state = useStorage(dillyStorage);
  const [redirecting, setRedirecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Check snooze expiration
    try {
      dillyStorage.checkSnoozeExpired();
    } catch {
      // Extension context invalidated - ignore
    }
  }, []);

  useEffect(() => {
    // Check if we should redirect
    if (state.isNaggerActive && state.targetUrl) {
      // Check if snoozed
      const isSnoozed = state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil;

      if (!isSnoozed) {
        setRedirecting(true);
        // Small delay for UX
        const timer = setTimeout(() => {
          window.location.href = state.targetUrl;
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [state.isNaggerActive, state.targetUrl, state.isSnoozed, state.snoozeUntil]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  // If redirecting, show redirect message
  if (redirecting) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-zinc-950 to-orange-950/20" />
        <div className="relative z-10 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
            <svg
              className="h-10 w-10 animate-pulse text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Redirecting to work...</h1>
          <p className="mt-2 text-zinc-500">Stay focused!</p>
        </div>
      </div>
    );
  }

  // If nagger is not active or snoozed, show a clean search page
  if (
    !state.isNaggerActive ||
    !state.targetUrl ||
    (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil)
  ) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900" />
        <div className="relative z-10 w-full max-w-xl px-6 text-center">
          {/* Search form */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Google..."
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 py-4 pl-12 pr-4 text-lg text-white placeholder-zinc-500 transition-all focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-700/50"
              />
            </div>
          </form>

          {/* Subtle Dilly branding */}
          <div className="flex items-center justify-center gap-2 text-zinc-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs">Dilly</span>
            {state.targetUrl && (
              <>
                <span className="text-zinc-700">·</span>
                <button
                  onClick={() => (window.location.href = state.targetUrl)}
                  className="text-xs text-zinc-500 transition-colors hover:text-amber-500">
                  Go to work
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't normally reach here)
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-zinc-950">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 via-zinc-950 to-orange-950/10" />
      <div className="relative z-10 text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
          <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Dilly</h1>
        <p className="mt-3 text-zinc-500">Set a work URL in the extension popup to get started</p>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(NewTab, <LoadingSpinner />), ErrorDisplay);
