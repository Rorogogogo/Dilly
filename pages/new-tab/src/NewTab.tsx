import '@src/NewTab.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { dillyStorage } from '@extension/storage';
import { ErrorDisplay, GithubWidget, LoadingSpinner } from '@extension/ui';
import { useEffect, useState } from 'react';
import type { DillyStateType } from '@extension/storage';

// D with clock logo component
const DillyLogo = ({ size = 48 }: { size?: number }) => (
  <svg style={{ width: `${size}px`, height: `${size}px` }} viewBox="0 0 24 24" fill="white">
    <path d="M3 2h9c5.523 0 10 4.477 10 10s-4.477 10-10 10H3V2zm9 16c3.314 0 6-2.686 6-6s-2.686-6-6-6H7v12h5z" />
    <circle cx="12" cy="12" r="4" fill="#dc2626" />
    <path d="M12 9v3l2 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NewTab = () => {
  const state = useStorage(dillyStorage) as DillyStateType;
  const [blockedSite, setBlockedSite] = useState<string>('');

  useEffect(() => {
    // Get blocked site from URL params
    const params = new URLSearchParams(window.location.search);
    const site = params.get('blocked');
    if (site) {
      try {
        setBlockedSite(new URL(decodeURIComponent(site)).hostname);
      } catch {
        setBlockedSite(site);
      }
    }

    // Check snooze expiration
    try {
      dillyStorage.checkSnoozeExpired();
    } catch {
      // Extension context invalidated - ignore
    }
  }, []);

  const handleGoToWork = () => {
    if (state.targetUrl) {
      window.location.href = state.targetUrl;
    }
  };

  const handleSnooze = async (minutes: number) => {
    await dillyStorage.snooze(minutes);
    // Go back to the blocked site after snoozing
    const params = new URLSearchParams(window.location.search);
    const site = params.get('blocked');
    if (site) {
      window.location.href = decodeURIComponent(site);
    }
  };

  // Get target hostname for display
  let targetHostname = '';
  try {
    if (state.targetUrl) {
      targetHostname = new URL(state.targetUrl).hostname;
    }
  } catch {
    targetHostname = state.targetUrl || '';
  }

  // Show blocked page overlay
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-red-600">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-600 to-red-800" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 text-center">
        {/* Icon */}
        <div className="mb-8 inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15">
          <DillyLogo size={48} />
        </div>

        {/* Main text */}
        <h1 className="mb-4 text-5xl font-bold text-white">GO BACK TO WORK!</h1>

        {blockedSite && (
          <p className="mb-2 text-lg text-white/70">
            <span className="font-medium text-white">{blockedSite}</span> is blocked
          </p>
        )}

        <p className="mb-8 text-lg text-white/80">
          You should be on <span className="font-medium text-white">{targetHostname}</span>
        </p>

        {/* CTA Button */}
        <button
          onClick={handleGoToWork}
          className="mb-8 inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-red-600 shadow-xl transition-transform hover:scale-105">
          Go back to work!
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* Snooze options */}
        <div className="mb-8">
          <p className="mb-3 text-sm text-white/60">Need a break?</p>
          <div className="flex justify-center gap-2">
            {[5, 10, 15].map(mins => (
              <button
                key={mins}
                onClick={() => handleSnooze(mins)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* Helper text */}
        <p className="text-sm text-white/50">This site is on your blocked list.</p>

        {/* GitHub */}
        <div className="mt-6">
          <GithubWidget variant="overlay" />
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(NewTab, <LoadingSpinner />), ErrorDisplay);
