import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { dillyStorage } from '@extension/storage';
import { ErrorDisplay, GithubWidget, LoadingSpinner } from '@extension/ui';
import { useEffect, useMemo, useState } from 'react';
import type { DillyStateType } from '@extension/storage';

// Helper to get root domain
const getRootDomain = (hostname: string): string => {
  const parts = hostname.replace(/^www\./, '').split('.');
  if (parts.length <= 2) return hostname.replace(/^www\./, '');
  return parts.slice(-2).join('.');
};

// D with clock logo component
const DillyLogo = ({ size = 16 }: { size?: number }) => (
  <svg style={{ width: `${size}px`, height: `${size}px` }} viewBox="0 0 24 24" fill="white">
    <path d="M3 2h9c5.523 0 10 4.477 10 10s-4.477 10-10 10H3V2zm9 16c3.314 0 6-2.686 6-6s-2.686-6-6-6H7v12h5z" />
    <circle cx="12" cy="12" r="4" fill="black" />
    <path d="M12 9v3l2 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SidePanel = () => {
  const state = useStorage(dillyStorage) as DillyStateType;
  const [newUrl, setNewUrl] = useState('');
  const [newSite, setNewSite] = useState('');
  const [currentTabUrl, setCurrentTabUrl] = useState('');
  const [awayDuration, setAwayDuration] = useState(0);
  const [focusDuration, setFocusDuration] = useState(0);
  const [goalTimeInput, setGoalTimeInput] = useState('60');
  const [showSettings, setShowSettings] = useState(false);
  const [snoozeRemaining, setSnoozeRemaining] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Get current tab URL and track changes
  useEffect(() => {
    const updateCurrentTab = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          setCurrentTabUrl(tab.url);
        }
      } catch {
        // Ignore errors
      }
    };

    updateCurrentTab();

    // Listen for tab changes
    const onActivated = async () => {
      await updateCurrentTab();
    };

    const onUpdated = async (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.url && tab.active) {
        setCurrentTabUrl(changeInfo.url);
      }
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  // Determine if on work site (must be before effects that use it)
  const isOnWorkSite = useMemo(() => {
    if (!state.targetUrl || !currentTabUrl) return true;
    try {
      const currentHost = new URL(currentTabUrl).hostname;
      const targetHost = new URL(state.targetUrl).hostname;
      return getRootDomain(currentHost) === getRootDomain(targetHost);
    } catch {
      return true;
    }
  }, [currentTabUrl, state.targetUrl]);

  // Check if snoozed (must be before effects that use it)
  const isSnoozed = state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil;

  // Poll away duration
  useEffect(() => {
    const interval = setInterval(async () => {
      const duration = await dillyStorage.getAwayDuration();
      setAwayDuration(duration);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track focus duration when on work site (using storage)
  useEffect(() => {
    if (isOnWorkSite && state.isNaggerActive && !isSnoozed) {
      // Start focus timer if not already started
      if (!state.lastWorkFocusStart) {
        dillyStorage.startWorkFocusTimer();
      }
    } else if (!isOnWorkSite && state.isNaggerActive && !isSnoozed) {
      // Pause when leaving work site
      if (state.lastWorkFocusStart) {
        dillyStorage.pauseWorkFocusTimer();
      }
    }
  }, [isOnWorkSite, state.isNaggerActive, state.lastWorkFocusStart, isSnoozed]);

  // Poll focus duration from storage
  useEffect(() => {
    const interval = setInterval(async () => {
      const duration = await dillyStorage.getWorkFocusDuration();
      setFocusDuration(duration);

      // Auto-stop when goal reached
      if (state.isNaggerActive && duration >= state.goalTimeMinutes * 60000) {
        await dillyStorage.stopNagger();
        setShowCelebration(true);
        // Send message to show celebration on work page
        chrome.runtime.sendMessage({ type: 'SHOW_CELEBRATION', goalMinutes: state.goalTimeMinutes });
        // Auto-hide celebration after 5 seconds
        setTimeout(() => setShowCelebration(false), 5000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isNaggerActive, state.goalTimeMinutes]);

  // Check snooze expiration and update snooze remaining
  useEffect(() => {
    const interval = setInterval(async () => {
      await dillyStorage.checkSnoozeExpired();

      // Update snooze remaining display
      if (state.isSnoozed && state.snoozeUntil) {
        const remaining = state.snoozeUntil - Date.now();
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setSnoozeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setSnoozeRemaining(null);
        }
      } else {
        setSnoozeRemaining(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isSnoozed, state.snoozeUntil]);

  // Show snooze mode if: nagger active AND snoozed AND not showing settings
  const showSnoozeMode = state.isNaggerActive && isSnoozed && !showSettings;

  // Show nagging mode if: nagger active AND not on work site AND not snoozed
  const showNaggingMode = state.isNaggerActive && !isOnWorkSite && !isSnoozed && !showSettings;

  // Show focus mode if: nagger active AND on work site AND not snoozed AND not showing settings
  const showFocusMode = state.isNaggerActive && isOnWorkSite && !isSnoozed && !showSettings;

  // Format duration
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handlers
  const handleSaveUrl = async () => {
    if (!newUrl) return;
    let url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    await dillyStorage.setTargetUrl(url);
    setNewUrl('');
  };

  const handleToggleNagger = async () => {
    if (!state.targetUrl && !state.isNaggerActive) {
      alert('Please set a target URL first!');
      return;
    }

    if (!state.isNaggerActive) {
      // Starting - set goal time and reset focus time
      const goalMins = parseInt(goalTimeInput) || 60;
      await dillyStorage.setGoalTime(goalMins);
      await dillyStorage.resetWorkFocusTime();
    }

    await dillyStorage.toggleNagger();
  };

  const handleSnooze = async (minutes: number) => {
    await dillyStorage.snooze(minutes);
  };

  const handleAddSite = async () => {
    if (!newSite) return;
    await dillyStorage.addEntertainmentSite(newSite.trim());
    setNewSite('');
  };

  const handleRemoveSite = async (site: string) => {
    await dillyStorage.removeEntertainmentSite(site);
  };

  const handleGoToWork = async () => {
    if (state.targetUrl) {
      await chrome.tabs.create({ url: state.targetUrl, active: true });
    }
  };

  // Celebration UI
  if (showCelebration) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 p-6 text-white">
        {/* Confetti particles */}
        <div className="pointer-events-none absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="animate-confetti absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}>
              <div
                style={{
                  width: `${8 + Math.random() * 8}px`,
                  height: `${8 + Math.random() * 8}px`,
                  backgroundColor: [
                    '#ff6b6b',
                    '#4ecdc4',
                    '#45b7d1',
                    '#96ceb4',
                    '#ffeaa7',
                    '#dfe6e9',
                    '#fd79a8',
                    '#a29bfe',
                  ][Math.floor(Math.random() * 8)],
                  borderRadius: Math.random() > 0.5 ? '50%' : '0',
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center">
          <div className="mb-6 text-8xl">🎉</div>
          <h1 className="mb-4 text-4xl font-bold">Goal Reached!</h1>
          <p className="mb-8 text-xl text-white/90">You worked for {formatDuration(state.goalTimeMinutes * 60000)}</p>
          <p className="text-lg text-white/70">Great job staying focused!</p>
        </div>

        {/* Close button */}
        <button
          onClick={() => setShowCelebration(false)}
          className="relative z-10 mt-8 rounded-lg bg-white/20 px-6 py-3 font-medium transition-colors hover:bg-white/30">
          Dismiss
        </button>

        <style>{`
          @keyframes confetti-fall {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          .animate-confetti {
            animation: confetti-fall linear forwards;
          }
        `}</style>
      </div>
    );
  }

  // Snooze Mode UI
  if (showSnoozeMode) {
    return (
      <div className="flex min-h-screen flex-col bg-blue-500 p-6 text-white">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <DillyLogo size={20} />
            </div>
            <span className="text-lg font-semibold">Dilly</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Sleeping Face */}
          <div className="mb-6 text-8xl">😴</div>

          <h1 className="mb-2 text-2xl font-bold">Taking a break</h1>
          <p className="mb-6 text-white/80">Snooze ends in</p>

          <div className="rounded-2xl bg-white/20 px-8 py-6">
            <p className="font-mono text-4xl font-bold">{snoozeRemaining || '0:00'}</p>
          </div>

          <button
            onClick={() => dillyStorage.clearSnooze()}
            className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20">
            End break early
          </button>
        </div>

        {/* Footer */}
        <div className="mt-auto flex justify-center border-t border-white/20 pt-4">
          <GithubWidget variant="overlay" />
        </div>
      </div>
    );
  }

  // Focus Mode UI (on work site)
  if (showFocusMode) {
    return (
      <div className="flex min-h-screen flex-col bg-white p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 2h9c5.523 0 10 4.477 10 10s-4.477 10-10 10H3V2zm9 16c3.314 0 6-2.686 6-6s-2.686-6-6-6H7v12h5z" />
                <circle cx="12" cy="12" r="4" fill="white" />
                <path
                  d="M12 9v3l2 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold text-black">Dilly</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-black">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Smile Face */}
          <div className="mb-6 text-8xl">😊</div>

          <h1 className="mb-2 text-2xl font-bold text-black">Great job!</h1>
          <p className="mb-6 text-gray-500">You&apos;re focused and working</p>

          <div className="rounded-2xl bg-green-50 px-8 py-6">
            <p className="mb-1 text-sm font-medium text-green-600">Focus Time</p>
            <p className="font-mono text-4xl font-bold text-green-700">{formatDuration(focusDuration)}</p>
            <p className="mt-2 text-sm text-green-600">Goal: {formatDuration(state.goalTimeMinutes * 60000)}</p>
            {/* Progress bar */}
            <div className="mt-3 h-2 w-full rounded-full bg-green-200">
              <div
                className="h-2 rounded-full bg-green-600 transition-all"
                style={{ width: `${Math.min(100, (focusDuration / (state.goalTimeMinutes * 60000)) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex justify-center border-t border-gray-100 pt-4">
          <GithubWidget variant="light" />
        </div>
      </div>
    );
  }

  // Nagging Mode UI
  if (showNaggingMode) {
    let targetHostname = '';
    try {
      targetHostname = new URL(state.targetUrl).hostname;
    } catch {
      targetHostname = state.targetUrl;
    }

    return (
      <div className="flex min-h-screen flex-col bg-red-600 p-6 text-white">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <DillyLogo size={20} />
            </div>
            <span className="text-lg font-semibold">Dilly</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Angry Face */}
          <div className="mb-6 text-8xl">😠</div>

          <h1 className="mb-4 text-4xl font-bold">GO BACK TO WORK!!!</h1>
          <p className="mb-2 text-lg text-white/80">You should be on {targetHostname}</p>
          <div className="mb-8">
            <p className="mb-1 text-sm text-white/60">Next nag in</p>
            <p className="font-mono text-3xl">{formatDuration(Math.max(0, 60000 - awayDuration))}</p>
          </div>

          <button
            onClick={handleGoToWork}
            className="mb-8 flex items-center gap-3 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-red-600 shadow-lg transition-transform hover:scale-105">
            Take me to work
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        {/* Snooze Section */}
        <div className="mt-auto">
          <p className="mb-3 text-center text-sm text-white/60">Need a break?</p>
          <div className="flex gap-2">
            {[5, 10, 15].map(mins => (
              <button
                key={mins}
                onClick={() => handleSnooze(mins)}
                className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-medium transition-colors hover:bg-white/20">
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* GitHub */}
        <div className="mt-4 flex justify-center">
          <GithubWidget variant="overlay" />
        </div>
      </div>
    );
  }

  // Settings Mode UI
  return (
    <div className="min-h-screen bg-white p-5">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black">
          <DillyLogo size={20} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-black">Dilly</h1>
          <p className="text-xs text-gray-500">Stay focused, get things done</p>
        </div>
        <div
          className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            state.isNaggerActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
          }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${state.isNaggerActive ? 'bg-white' : 'bg-gray-400'}`} />
          {state.isNaggerActive ? 'Active' : 'Off'}
        </div>
      </div>

      {/* Back button when in settings from nagging */}
      {showSettings && state.isNaggerActive && !isOnWorkSite && (
        <button
          onClick={() => setShowSettings(false)}
          className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-black">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Nagging
        </button>
      )}

      {/* Target URL */}
      <div className="mb-4">
        <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">Work URL</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="Enter your work URL..."
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-black placeholder-gray-400 transition-colors focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            onKeyDown={e => e.key === 'Enter' && handleSaveUrl()}
          />
          <button
            onClick={handleSaveUrl}
            className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-black transition-all hover:bg-gray-200 active:scale-95">
            Set
          </button>
        </div>
        {state.targetUrl && (
          <p className="mt-2 truncate rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-500" title={state.targetUrl}>
            <span className="text-gray-400">Current:</span> {state.targetUrl}
          </p>
        )}
      </div>

      {/* Goal Time - only show when not active */}
      {!state.isNaggerActive && (
        <div className="mb-4">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">Work Goal</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={goalTimeInput}
              onChange={e => setGoalTimeInput(e.target.value)}
              min="1"
              max="480"
              className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-black placeholder-gray-400 transition-colors focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
            <span className="text-sm text-gray-500">minutes</span>
          </div>
        </div>
      )}

      {/* Start/Stop Button */}
      <button
        onClick={handleToggleNagger}
        className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
          state.isNaggerActive
            ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-200'
            : 'bg-black text-white hover:bg-gray-800'
        }`}>
        {state.isNaggerActive ? (
          <>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop Working
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Working
          </>
        )}
      </button>

      {/* Snooze Section */}
      {state.isNaggerActive && (
        <div className="mb-4">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Snooze
            {snoozeRemaining && <span className="ml-auto font-mono normal-case text-black">{snoozeRemaining}</span>}
          </span>
          <div className="flex gap-2">
            {[5, 10, 15].map(mins => (
              <button
                key={mins}
                onClick={() => handleSnooze(mins)}
                className="flex-1 rounded-lg bg-gray-50 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-all hover:bg-gray-100 hover:text-black active:scale-95">
                {mins}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entertainment Sites */}
      <div>
        <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          Blocked Sites
        </span>
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={newSite}
            onChange={e => setNewSite(e.target.value)}
            placeholder="example.com"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-black placeholder-gray-400 transition-colors focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            onKeyDown={e => e.key === 'Enter' && handleAddSite()}
          />
          <button
            onClick={handleAddSite}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200 hover:text-black active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-50 ring-1 ring-gray-200">
          {state.entertainmentSites.length === 0 ? (
            <p className="p-3 text-center text-xs text-gray-400">No blocked sites yet</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {state.entertainmentSites.map(site => (
                <li key={site} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate text-gray-600">{site}</span>
                  <button
                    onClick={() => handleRemoveSite(site)}
                    className="ml-2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-black"
                    title="Remove">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-center border-t border-gray-100 pt-4">
        <GithubWidget variant="light" />
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
