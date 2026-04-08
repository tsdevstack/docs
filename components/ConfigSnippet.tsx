export function ConfigSnippet() {
  return (
    <div style={{
      maxWidth: '1024px',
      margin: '0 auto',
      padding: '2rem 1.5rem 4rem',
    }}>
      <h2 style={{
        textAlign: 'center',
        fontSize: 'clamp(1.5rem, 3vw, 2rem)',
        fontWeight: 700,
        color: 'var(--rp-c-text-1)',
        margin: '0 0 0.5rem',
      }}>
        One config. Full infrastructure.
      </h2>
      <p style={{
        textAlign: 'center',
        fontSize: '1.05rem',
        color: 'var(--rp-c-text-2)',
        margin: '0 0 2rem',
      }}>
        You define your project. The framework generates Terraform, Docker Compose, Kong routes, CI/CD pipelines, and secrets.
      </p>

      <div className="config-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.25rem',
      }}>
        {/* Left: What you write */}
        <div style={{
          borderRadius: '12px',
          background: 'var(--rp-c-bg-soft)',
          border: '1px solid var(--rp-c-divider)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.6rem 1rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--rp-c-text-2)',
            borderBottom: '1px solid var(--rp-c-divider)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            config.json
          </div>
          <pre style={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            color: 'var(--rp-c-text-1)',
            overflow: 'auto',
          }}>{`{
  "projectName": "my-saas",
  "cloud": "gcp",
  "services": [
    {
      "name": "auth-service",
      "type": "nestjs",
      "hasDatabase": true
    },
    {
      "name": "frontend",
      "type": "nextjs"
    }
  ],
  "storage": {
    "buckets": ["uploads"]
  }
}`}</pre>
        </div>

        {/* Right: What gets generated */}
        <div style={{
          borderRadius: '12px',
          background: 'var(--rp-c-bg-soft)',
          border: '1px solid var(--rp-c-divider)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.6rem 1rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--rp-c-text-2)',
            borderBottom: '1px solid var(--rp-c-divider)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Generated infrastructure
          </div>
          <div style={{
            padding: '1rem',
            fontSize: '0.85rem',
            lineHeight: 1.8,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            color: 'var(--rp-c-text-2)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '8px auto 1fr',
              gap: '0.4rem 0.5rem',
              alignItems: 'center',
            }}>
              {[
                { color: '#34A853', label: 'Terraform', detail: 'VPC, Cloud SQL, Redis, Cloud Run, IAM' },
                { color: '#4285F4', label: 'Docker Compose', detail: 'Postgres, Redis, Kong, MinIO, services' },
                { color: '#F46800', label: 'Kong Gateway', detail: 'Routes from OpenAPI, JWT validation, rate limiting' },
                { color: '#E6522C', label: 'Observability', detail: 'Prometheus, Grafana, Jaeger, structured logging' },
                { color: '#FBBC05', label: 'CI/CD', detail: 'GitHub Actions workflows, OIDC auth, per-service deploy' },
                { color: '#0078D4', label: 'Secrets', detail: 'JWT keys, API keys, DB URLs \u2014 local and cloud' },
                { color: '#EA4335', label: 'WAF', detail: 'Cloud Armor / AWS WAF / Front Door rules' },
                { color: '#60D0E4', label: 'Storage', detail: 'S3 / GCS / Azure Blob + MinIO for local dev' },
              ].flatMap((item) => [
                <span key={`${item.label}-dot`} style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: item.color,
                }} />,
                <span key={`${item.label}-label`} style={{ color: 'var(--rp-c-text-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>,
                <span key={`${item.label}-detail`} style={{ color: 'var(--rp-c-text-2)' }}>{item.detail}</span>,
              ])}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .config-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
