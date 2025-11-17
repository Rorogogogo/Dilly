/* eslint-disable jsx-a11y/mouse-events-have-key-events */
import { useStorage } from '@extension/shared';
import { dillyStorage } from '@extension/storage';
import { useEffect, useState } from 'react';

export default function CornerWidget() {
  const state = useStorage(dillyStorage);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);

  // Check snooze expiration periodically
  useEffect(() => {
    const checkSnooze = async () => {
      try {
        await dillyStorage.checkSnoozeExpired();
      } catch {
        // Extension context invalidated - ignore
      }
    };

    const interval = setInterval(checkSnooze, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update time remaining display
  useEffect(() => {
    if (!state.isSnoozed || !state.snoozeUntil) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const remaining = state.snoozeUntil! - Date.now();
      if (remaining <= 0) {
        setTimeRemaining('');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [state.isSnoozed, state.snoozeUntil]);

  // Don't render if nagger is not active
  if (!state.isNaggerActive || !state.targetUrl) {
    return null;
  }

  // Check if we're on the target domain
  const currentHostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  let targetHostname = '';
  try {
    targetHostname = new URL(state.targetUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }

  // Get root domains for comparison
  const getRootDomain = (hostname: string) => {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  };

  const isOnTargetDomain = getRootDomain(currentHostname) === getRootDomain(targetHostname);

  // Don't show on target domain
  if (isOnTargetDomain) {
    return null;
  }

  // Check if snoozed
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    return null;
  }

  // Check if this is an entertainment site - don't show widget there (overlay will show instead)
  const isEntertainment = state.entertainmentSites.some(site => {
    const normalizedSite = site.toLowerCase().replace(/^www\./, '');
    return currentHostname === normalizedSite || currentHostname.endsWith('.' + normalizedSite);
  });

  if (isEntertainment) {
    return null;
  }

  const handleGoToWork = () => {
    window.location.href = state.targetUrl;
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 2147483647,
          display: 'flex',
          width: '48px',
          height: '48px',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '16px',
          background: 'linear-gradient(to bottom right, #fbbf24, #f97316)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.3)',
          transition: 'all 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Dilly - Click to expand">
        <svg
          style={{ width: '24px', height: '24px', color: 'white' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 2147483647,
        width: '288px',
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid rgba(39, 39, 42, 0.5)',
        backgroundColor: 'rgba(9, 9, 11, 0.95)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(39, 39, 42, 0.5)',
          padding: '12px 16px',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              width: '32px',
              height: '32px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              background: 'linear-gradient(to bottom right, #fbbf24, #f97316)',
              boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.2)',
            }}>
            <svg
              style={{ width: '16px', height: '16px', color: 'white' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Dilly</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            display: 'flex',
            width: '24px',
            height: '24px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: '#71717a',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => {
            e.currentTarget.style.backgroundColor = '#27272a';
            e.currentTarget.style.color = '#d4d4d8';
          }}
          onMouseOut={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#71717a';
          }}
          title="Minimize">
          <svg
            style={{ width: '16px', height: '16px' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        <p style={{ marginBottom: '12px', fontSize: '14px', color: '#a1a1aa' }}>
          Time to focus on <span style={{ fontWeight: 500, color: '#fbbf24' }}>{targetHostname}</span>
        </p>

        {timeRemaining && (
          <div
            style={{
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '8px',
              backgroundColor: 'rgba(24, 24, 27, 0.5)',
              padding: '8px 12px',
              boxShadow: 'inset 0 0 0 1px #27272a',
            }}>
            <svg
              style={{ width: '14px', height: '14px', color: '#71717a' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontSize: '12px', color: '#71717a' }}>Snooze ends in</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '12px', color: '#fbbf24' }}>
              {timeRemaining}
            </span>
          </div>
        )}

        <button
          onClick={handleGoToWork}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            borderRadius: '12px',
            background: 'linear-gradient(to right, #f59e0b, #f97316)',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.25)',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => {
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(249, 115, 22, 0.4)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(249, 115, 22, 0.25)';
          }}>
          Go to Work
          <svg
            style={{ width: '16px', height: '16px' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
