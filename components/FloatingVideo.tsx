import { useState } from 'react';

export function FloatingVideo() {
  const [expanded, setExpanded] = useState(false);

  const YOUTUBE_ID = '6MJ4PPPjxH8';

  if (expanded) {
    return (
      <div
        onClick={() => setExpanded(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '90vw',
            maxWidth: '960px',
            aspectRatio: '16/9',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1`}
            title="tsdevstack demo"
            frameBorder="0"
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{ display: 'block' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setExpanded(true)}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        width: '280px',
        aspectRatio: '16/9',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '2px solid var(--rp-c-divider)',
        background: '#000',
        zIndex: 100,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
      }}
    >
      <img
        src={`https://img.youtube.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`}
        alt="tsdevstack demo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.25)',
      }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.5)" stroke="white" strokeWidth="2" />
          <path d="M19 14l16 10-16 10V14z" fill="white" />
        </svg>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0.4rem 0.6rem',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        color: 'white',
        fontSize: '0.75rem',
        fontWeight: 500,
      }}>
        Watch the demo — 90s
      </div>
    </div>
  );
}
