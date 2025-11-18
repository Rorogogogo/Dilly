import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { dillyStorage } from '@extension/storage';
import { ErrorDisplay, GithubWidget, LoadingSpinner } from '@extension/ui';
import { useState } from 'react';

const Popup = () => {
  const state = useStorage(dillyStorage);
  const [newUrl, setNewUrl] = useState('');
  const [newSite, setNewSite] = useState('');

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

  const getSnoozeRemaining = () => {
    if (!state.isSnoozed || !state.snoozeUntil) return null;
    const remaining = state.snoozeUntil - Date.now();
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const snoozeRemaining = getSnoozeRemaining();

  return (
    <div className="bg-white p-5">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
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
            Stop Nagger
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Nagger
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
        <div className="max-h-28 overflow-y-auto rounded-lg bg-gray-50 ring-1 ring-gray-200">
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

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
