/* eslint-disable jsx-a11y/mouse-events-have-key-events */
import { useEffect, useState } from 'react';

type GithubWidgetProps = {
  variant?: 'light' | 'dark' | 'overlay' | 'content-light';
};

export const GithubWidget = ({ variant = 'light' }: GithubWidgetProps) => {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/Rorogogogo/Dilly')
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {
        // Silently fail
      });
  }, []);

  const handleClick = () => {
    window.open('https://github.com/Rorogogogo/Dilly', '_blank');
  };

  if (variant === 'overlay') {
    return (
      <button
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onMouseOver={e => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseOut={e => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
        }}>
        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {stars !== null && <span>{stars}</span>}
      </button>
    );
  }

  if (variant === 'dark') {
    return (
      <button
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'rgba(39, 39, 42, 0.5)',
          color: '#a1a1aa',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onMouseOver={e => {
          e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.8)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseOut={e => {
          e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.5)';
          e.currentTarget.style.color = '#a1a1aa';
        }}>
        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {stars !== null && <span>{stars}</span>}
      </button>
    );
  }

  if (variant === 'content-light') {
    return (
      <button
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#f3f4f6',
          color: '#4b5563',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onMouseOver={e => {
          e.currentTarget.style.backgroundColor = '#e5e7eb';
          e.currentTarget.style.color = 'black';
        }}
        onMouseOut={e => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
          e.currentTarget.style.color = '#4b5563';
        }}>
        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {stars !== null && <span>{stars}</span>}
      </button>
    );
  }

  // Light variant (for popup)
  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition-all hover:bg-gray-200 hover:text-black">
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
      {stars !== null && <span>{stars}</span>}
    </button>
  );
};
