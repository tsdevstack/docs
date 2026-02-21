import type { ReactNode } from 'react';

function CloudProviderLogos() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {/* Google Cloud */}
      <svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.1 4.5l1.5-1.5.1-.6C12.5.4 9.5-.5 6.8.3 4.1 1.1 2 3.2 1.2 5.9l.5-.1 3-0.5.2-.2c1.3-1.4 3.3-2 5.2-1.5l.2.1 2.8-.2z" fill="#EA4335"/>
        <path d="M17.6 5.9c-.5-1.8-1.6-3.4-3.1-4.5l-2.7 2.7c1.2.9 1.9 2.3 1.9 3.8v.5c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5H8.7l-.5.5v3l.5.5h5c3.1 0 5.6-2.4 5.7-5.5.1-2-.9-3.9-2.5-5l.7-1z" fill="#4285F4"/>
        <path d="M3.7 14.9h5v-3h-5c-.4 0-.7-.1-1-.2l-.7.2-2 2-.2.6c1.1.9 2.5 1.4 3.9 1.4z" fill="#34A853"/>
        <path d="M3.7 3.9C.6 3.9-1.9 6.5-2 9.6c0 1.9.9 3.6 2.4 4.7l2.9-2.9c-1-.5-1.4-1.6-1-2.6.5-1 1.6-1.4 2.6-1 .4.2.8.5 1 1l2.9-2.9C7.5 4.7 5.6 3.9 3.7 3.9z" fill="#FBBC05"/>
      </svg>
      {/* AWS */}
      <svg width="30" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="13" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="700" letterSpacing="-0.5" fill="#FF9900">AWS</text>
        <path d="M2 17c7-3 15-3.2 24-1" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M23 13.5l3.5 2.5-5 .5" fill="#FF9900"/>
      </svg>
      {/* Azure */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.5 1L1.5 16h3.7L7.5 1z" fill="#0078D4"/>
        <path d="M7.5 1l6.5 13-10 3.5H18L7.5 1z" fill="#0078D4" opacity="0.8"/>
        <path d="M1.5 16l6.5-2-4.5-5L1.5 16z" fill="#0078D4" opacity="0.6"/>
      </svg>
    </div>
  );
}

function OSILogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* OSI keyhole logo — circle with keyhole cutout */}
      <circle cx="12" cy="12" r="11" fill="#3DA639"/>
      <circle cx="12" cy="9" r="3.5" fill="white"/>
      <path d="M9.5 11l-2 9h9l-2-9z" fill="white"/>
    </svg>
  );
}

function ComplianceLogos() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {/* SOC 2 — AICPA shield */}
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 0L0 4v8c0 6.6 4.3 11.2 10 12 5.7-.8 10-5.4 10-12V4L10 0z" fill="#1A3E72"/>
        <text x="10" y="14" fontFamily="system-ui, -apple-system, sans-serif" fontSize="6" fontWeight="700" fill="white" textAnchor="middle">SOC</text>
        <text x="10" y="20" fontFamily="system-ui, -apple-system, sans-serif" fontSize="5" fontWeight="600" fill="white" textAnchor="middle">2</text>
      </svg>
      {/* ISO 27001 — globe with gear */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10.5" stroke="#00529B" strokeWidth="1.5" fill="none"/>
        <ellipse cx="12" cy="12" rx="5" ry="10.5" stroke="#00529B" strokeWidth="1" fill="none"/>
        <line x1="1.5" y1="8" x2="22.5" y2="8" stroke="#00529B" strokeWidth="1"/>
        <line x1="1.5" y1="16" x2="22.5" y2="16" stroke="#00529B" strokeWidth="1"/>
        <line x1="12" y1="1.5" x2="12" y2="22.5" stroke="#00529B" strokeWidth="1"/>
      </svg>
      {/* GDPR — EU stars circle */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="#003399"/>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x = 12 + 8 * Math.sin(rad);
          const y = 12 - 8 * Math.cos(rad);
          return (
            <polygon
              key={angle}
              points={`${x},${y - 1.5} ${x + 0.6},${y - 0.5} ${x + 1.5},${y - 0.5} ${x + 0.8},${y + 0.2} ${x + 1},${y + 1.3} ${x},${y + 0.7} ${x - 1},${y + 1.3} ${x - 0.8},${y + 0.2} ${x - 1.5},${y - 0.5} ${x - 0.6},${y - 0.5}`}
              fill="#FFCC00"
            />
          );
        })}
      </svg>
    </div>
  );
}

function ObservabilityLogos() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {/* Prometheus — fire/torch icon */}
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 0C10 0 6 4 6 8c0 2.2 1.8 4 4 4s4-1.8 4-4C14 4 10 0 10 0z" fill="#E6522C"/>
        <path d="M10 5c0 0-2 2-2 4 0 1.1.9 2 2 2s2-.9 2-2c0-2-2-4-2-4z" fill="#F8B886"/>
        <rect x="4" y="14" width="12" height="2" rx="1" fill="#E6522C"/>
        <rect x="5" y="17" width="10" height="2" rx="1" fill="#E6522C"/>
        <rect x="6" y="20" width="8" height="1.5" rx="0.75" fill="#E6522C"/>
      </svg>
      {/* Grafana — dashboard/eye icon */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="10" stroke="#F46800" strokeWidth="1.5" fill="none"/>
        <circle cx="11" cy="11" r="4" fill="#F46800"/>
        <circle cx="11" cy="11" r="1.5" fill="#FFC266"/>
        <line x1="11" y1="1" x2="11" y2="4" stroke="#F46800" strokeWidth="1.5"/>
        <line x1="11" y1="18" x2="11" y2="21" stroke="#F46800" strokeWidth="1.5"/>
        <line x1="1" y1="11" x2="4" y2="11" stroke="#F46800" strokeWidth="1.5"/>
        <line x1="18" y1="11" x2="21" y2="11" stroke="#F46800" strokeWidth="1.5"/>
      </svg>
      {/* Jaeger — trace/span icon */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="3" cy="6" r="2.5" fill="#60D0E4"/>
        <circle cx="11" cy="11" r="2.5" fill="#60D0E4"/>
        <circle cx="19" cy="16" r="2.5" fill="#60D0E4"/>
        <line x1="5" y1="7" x2="9" y2="10" stroke="#60D0E4" strokeWidth="1.5"/>
        <line x1="13" y1="12" x2="17" y2="15" stroke="#60D0E4" strokeWidth="1.5"/>
      </svg>
      {/* Monitor — screen icon */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="2" width="20" height="14" rx="2" stroke="var(--rp-c-text-2)" strokeWidth="1.5" fill="none"/>
        <polyline points="4,12 8,8 11,10 14,6 18,9" stroke="var(--rp-c-brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="8" y1="19" x2="14" y2="19" stroke="var(--rp-c-text-2)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="11" y1="16" x2="11" y2="19" stroke="var(--rp-c-text-2)" strokeWidth="1.5"/>
      </svg>
    </div>
  );
}

function AuthIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield with lock */}
      <path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5L12 1z" stroke="var(--rp-c-brand)" strokeWidth="1.5" fill="none"/>
      <rect x="9" y="10" width="6" height="5" rx="1" fill="var(--rp-c-brand)"/>
      <circle cx="12" cy="8.5" r="2.5" stroke="var(--rp-c-brand)" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

function MCPIcon() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* AI sparkle — large 4-pointed star */}
        <path d="M12 1l2 7.5L21.5 10l-7.5 2L12 19.5 10 12 2.5 10l7.5-2L12 1z" fill="var(--rp-c-brand)"/>
        {/* Small sparkle top-right */}
        <path d="M19.5 2l.75 2.25L22.5 5l-2.25.75L19.5 8l-.75-2.25L16.5 5l2.25-.75L19.5 2z" fill="var(--rp-c-brand)" opacity="0.5"/>
        {/* Tiny sparkle bottom-left */}
        <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" fill="var(--rp-c-brand)" opacity="0.35"/>
      </svg>
    </div>
  );
}


interface Feature {
  icon: ReactNode;
  title: string;
  details: string;
}

const features: Feature[] = [
  {
    icon: <MCPIcon />,
    title: 'Built for AI agents',
    details: 'MCP server included. Claude Code, Cursor, VS Code Copilot manage your stack — deploy, query, debug with 31 tools.',
  },
  {
    icon: <CloudProviderLogos />,
    title: 'Multi-cloud infrastructure',
    details: 'GCP, AWS, Azure. Same framework, generated Terraform, CI/CD pipelines.',
  },
  {
    icon: <OSILogo />,
    title: 'Free & open source',
    details: 'Bring your own cloud account. No vendor lock-in, no platform fees. You only pay your cloud provider.',
  },
  {
    icon: <ComplianceLogos />,
    title: 'Audit-ready infrastructure',
    details: 'SOC 2, ISO 27001, GDPR technical controls built in. Encryption, network isolation, zero-credential runtimes, environment separation.',
  },
  {
    icon: <AuthIcon />,
    title: 'Authentication built in',
    details: 'JWT token management, protected routes, session handling. Or bring your own OIDC.',
  },
  {
    icon: <ObservabilityLogos />,
    title: 'Observability from day one',
    details: 'Prometheus metrics, Grafana dashboards, distributed tracing with Jaeger.',
  },
];

export function FeatureGrid() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.25rem',
      padding: '2rem 1.5rem 3rem',
      maxWidth: '1024px',
      margin: '0 auto',
    }}>
      {features.map((feature) => (
        <div
          key={feature.title}
          style={{
            padding: '1.5rem',
            borderRadius: '12px',
            background: 'var(--rp-c-bg-soft)',
            border: '1px solid var(--rp-c-divider)',
            transition: 'border-color 0.25s',
          }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
            {feature.icon}
          </div>
          <h3 style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            margin: '0 0 0.5rem',
            color: 'var(--rp-c-text-1)',
          }}>
            {feature.title}
          </h3>
          <p style={{
            fontSize: '0.9rem',
            color: 'var(--rp-c-text-2)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {feature.details}
          </p>
        </div>
      ))}
    </div>
  );
}
