export function CloudArchitectureDiagram() {
  return (
    <pre style={{
      fontSize: '0.85em',
      lineHeight: '1.4',
      overflow: 'auto',
      background: 'var(--rp-c-bg-soft)',
      padding: '1rem',
      borderRadius: '8px'
    }}>
{`                              Internet
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │      Cloud Load Balancer    │
                    │    • TLS termination        │
                    │    • WAF rules              │
                    │    • Health checks          │
                    └─────────────┬───────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐  ┌───────────────────────────────────────────────┐
│ CDN / Bucket  │  │              Private Network                  │
│(static assets)│  │                                               │
│               │  │  ┌─────────────────┐   ┌───────────────────┐  │
│ • SPA apps    │  │  │  Kong Gateway   │   │  Next.js Frontend │  │
│ • Edge cache  │  │  │  (api.*)        │   │  (example.com)    │  │
│               │  │  │  • JWT, CORS    │   │  • SSR container  │  │
└───────────────┘  │  └────────┬────────┘   └───────────────────┘  │
                   │           │                                   │
                   │     ┌─────┴─────────────────┐                 │
                   │     │           │           │                 │
                   │     ▼           ▼           ▼                 │
                   │  ┌───────┐ ┌─────────┐ ┌───────┐              │
                   │  │ Auth  │ │ Offers  │ │  BFF  │              │
                   │  │Service│ │ Service │ │       │              │
                   │  └───┬───┘ └────┬────┘ └───┬───┘              │
                   │      │          │          │                  │
                   │      ▼          ▼          ▼                  │
                   │  ┌───────────────────────────────────────┐    │
                   │  │          Managed PostgreSQL           │    │
                   │  │    • Private IP • Per-service DBs     │    │
                   │  └───────────────────────────────────────┘    │
                   │                                               │
                   │  ┌───────────────────────────────────────┐    │
                   │  │            Managed Redis              │    │
                   │  │    • Rate limiting • Sessions         │    │
                   │  └───────────────────────────────────────┘    │
                   │                                               │
                   │  ┌───────────────────────────────────────┐    │
                   │  │           Secret Manager              │    │
                   │  │    • JWT keys • DB credentials        │    │
                   │  └───────────────────────────────────────┘    │
                   │                                               │
                   └───────────────────────────────────────────────┘`}
    </pre>
  );
}