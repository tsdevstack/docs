export function LocalArchitectureDiagram() {
  return (
    <pre style={{
      fontSize: '0.85em',
      lineHeight: '1.4',
      overflow: 'auto',
      background: 'var(--rp-c-bg-soft)',
      padding: '1rem',
      borderRadius: '8px'
    }}>
{`┌─────────────────────────────────────────────────────────────┐
│  Docker Compose Network                                     │
│                                                             │
│    Browser ──► localhost:8000                               │
│                    │                                        │
│                    ▼                                        │
│              ┌──────────┐                                   │
│              │   Kong   │                                   │
│              └────┬─────┘                                   │
│                   │                                         │
│      ┌────────────┼────────────┐                            │
│      ▼            ▼            ▼                            │
│  ┌────────┐  ┌────────┐  ┌────────┐                         │
│  │  Auth  │  │ Offers │  │  BFF   │  (hot reload)           │
│  │ :3001  │  │ :3002  │  │ :3003  │                         │
│  └───┬────┘  └───┬────┘  └───┬────┘                         │
│      │           │           │                              │
│      └───────────┴───────────┘                              │
│                  │                                          │
│      ┌───────────┴───────────┐                              │
│      ▼                       ▼                              │
│  ┌────────┐             ┌────────┐                          │
│  │Postgres│             │ Redis  │                          │
│  │ :5432  │             │ :6379  │                          │
│  └────────┘             └────────┘                          │
│                                                             │
│  Observability:                                             │
│  Prometheus :9090 │ Grafana :4001 │ Jaeger :16686           │
└─────────────────────────────────────────────────────────────┘`}
    </pre>
  );
}