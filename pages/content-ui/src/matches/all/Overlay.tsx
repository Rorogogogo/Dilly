/* eslint-disable jsx-a11y/mouse-events-have-key-events */
import { useStorage } from '@extension/shared';
import { dillyStorage } from '@extension/storage';
import { useEffect, useRef } from 'react';

export default function Overlay() {
  const state = useStorage(dillyStorage);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Make overlay unremovable - re-render if user tries to delete it
  useEffect(() => {
    if (!overlayRef.current) return;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.removedNodes.length > 0) {
          // Element was removed, force re-render by updating state
          window.location.reload();
        }
      });
    });

    const parent = overlayRef.current.parentElement;
    if (parent) {
      observer.observe(parent, { childList: true });
    }

    return () => observer.disconnect();
  }, []);

  // Don't render if nagger is not active
  if (!state.isNaggerActive || !state.targetUrl) {
    return null;
  }

  // Check if snoozed
  if (state.isSnoozed && state.snoozeUntil && Date.now() < state.snoozeUntil) {
    return null;
  }

  // Check if this is an entertainment site
  const currentHostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const isEntertainment = state.entertainmentSites.some(site => {
    const normalizedSite = site.toLowerCase().replace(/^www\./, '');
    return currentHostname === normalizedSite || currentHostname.endsWith('.' + normalizedSite);
  });

  // Only show on entertainment sites
  if (!isEntertainment) {
    return null;
  }

  const handleGoToWork = () => {
    window.location.href = state.targetUrl;
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#dc2626',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
      {/* Gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom right, #b91c1c, #dc2626, #991b1b)',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px' }}>
        {/* Icon */}
        <div
          style={{
            marginBottom: '32px',
            display: 'inline-flex',
            width: '96px',
            height: '96px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          }}>
          <svg
            style={{ width: '48px', height: '48px', color: 'white' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        {/* Main text */}
        <h1
          style={{
            marginBottom: '16px',
            fontSize: '56px',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: 'white',
            lineHeight: 1.1,
          }}>
          GO BACK TO WORK
        </h1>

        <p style={{ marginBottom: '40px', fontSize: '20px', color: 'rgba(255, 255, 255, 0.8)' }}>
          You shouldn't be here. You have things to accomplish.
        </p>

        {/* CTA Button */}
        <button
          onClick={handleGoToWork}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            borderRadius: '16px',
            backgroundColor: 'white',
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 600,
            color: '#dc2626',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'scale(1)';
          }}>
          Take me to work
          <svg
            style={{ width: '20px', height: '20px' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* Helper text */}
        <p style={{ marginTop: '32px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
          This site is on your blocked list.
          <br />
          <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Use the Dilly popup to snooze if you need a break.</span>
        </p>
      </div>
    </div>
  );
}
