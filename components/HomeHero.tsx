export function HomeHero() {
  return (
    <div className="home-hero" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '6rem 1.5rem 3rem',
      maxWidth: '800px',
      margin: '0 auto',
    }}>
      <span style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: 'var(--rp-c-brand)',
        background: 'color-mix(in srgb, var(--rp-c-brand) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--rp-c-brand) 25%, transparent)',
        marginBottom: '1.5rem',
      }}>
        Currently in Beta
      </span>
      <h1 style={{
        fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
        fontWeight: 700,
        lineHeight: 1.1,
        margin: '0 0 1rem',
        background: 'linear-gradient(315deg, var(--rp-c-brand) 30%, var(--rp-c-brand-light, var(--rp-c-brand)))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        tsdevstack
      </h1>
      <p style={{
        fontSize: 'clamp(1.5rem, 4vw, 3rem)',
        fontWeight: 700,
        lineHeight: 1.2,
        margin: '0 0 1rem',
        color: 'var(--rp-c-text-1)',
      }}>
        Full-stack, cloud-native TypeScript microservices
      </p>
      <p style={{
        fontSize: 'clamp(1rem, 2vw, 1.5rem)',
        fontWeight: 500,
        color: 'var(--rp-c-text-2)',
        margin: '0 0 2rem',
      }}>
        From zero to production in an hour, not months
      </p>
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <a
          href="mailto:hello@tsdevstack.dev?subject=Early access request"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            borderRadius: '24px',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--rp-c-brand)',
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          Request Early Access
        </a>
        <a
          href="/introduction/what-is-tsdevstack"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            borderRadius: '24px',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--rp-c-text-1)',
            background: 'var(--rp-c-bg-soft)',
            border: '1px solid var(--rp-c-divider)',
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          Why tsdevstack?
        </a>
      </div>
    </div>
  );
}
