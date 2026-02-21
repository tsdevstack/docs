function GCPLogo() {
  return (
    <svg width="140" height="22" viewBox="0 0 140 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.1 6.5l1.5-1.5.1-.6C12.5 2.4 9.5 1.5 6.8 2.3 4.1 3.1 2 5.2 1.2 7.9l.5-.1 3-0.5.2-.2c1.3-1.4 3.3-2 5.2-1.5l.2.1 2.8-0.2z" fill="#EA4335"/>
      <path d="M17.6 7.9c-.5-1.8-1.6-3.4-3.1-4.5l-2.7 2.7c1.2.9 1.9 2.3 1.9 3.8v.5c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5H8.7l-.5.5v3l.5.5h5c3.1 0 5.6-2.4 5.7-5.5.1-2-.9-3.9-2.5-5l.7-1z" fill="#4285F4"/>
      <path d="M3.7 16.9h5v-3h-5c-.4 0-.7-.1-1-.2l-.7.2-2 2-.2.6c1.1.9 2.5 1.4 3.9 1.4z" fill="#34A853"/>
      <path d="M3.7 5.9C.6 5.9-1.9 8.5-2 11.6c0 1.9.9 3.6 2.4 4.7l2.9-2.9c-1-.5-1.4-1.6-1-2.6.5-1 1.6-1.4 2.6-1 .4.2.8.5 1 1l2.9-2.9C7.5 6.7 5.6 5.9 3.7 5.9z" fill="#FBBC05"/>
      <text x="24" y="15.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="500" fill="var(--rp-c-text-1)">Google Cloud</text>
    </svg>
  );
}

function AWSLogo() {
  return (
    <svg width="52" height="22" viewBox="0 0 52 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="15" fontFamily="system-ui, -apple-system, sans-serif" fontSize="15" fontWeight="700" letterSpacing="-0.5" fill="#FF9900">AWS</text>
      <path d="M3 19c13-4 26-4.5 42-1.5" stroke="#FF9900" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M40 14.5l5.5 3.5-8 1" fill="#FF9900"/>
    </svg>
  );
}

function AzureLogo() {
  return (
    <svg width="100" height="22" viewBox="0 0 100 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.2 2L4 17.7h4.1L10.2 2z" fill="#0078D4"/>
      <path d="M10.2 2l6.5 13.7L5.5 19.5h15.3L10.2 2z" fill="#0078D4" opacity="0.8"/>
      <path d="M4 17.7l7.2-2.1-5.1-5.8L4 17.7z" fill="#0078D4" opacity="0.6"/>
      <text x="25" y="15.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="500" fill="var(--rp-c-text-1)">Azure</text>
    </svg>
  );
}

export function CloudProviders() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1.5rem 1rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '2.5rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
      }}>
        <GCPLogo />
        <AWSLogo />
        <AzureLogo />
      </div>
      <p style={{
        color: 'var(--rp-c-text-2)',
        fontSize: '1.05rem',
        margin: 0,
      }}>
        Deploy to any major cloud provider
      </p>
    </div>
  );
}
