interface ColumnProps {
  title: string;
  subtitle: string;
  items: string[];
}

const runtime: string[] = [
  "Authentication (JWT, Kong user injection)",
  "Database with Prisma and migrations",
  "Logging, Prometheus metrics, OpenTelemetry tracing",
  "BullMQ workers and scheduled jobs",
  "Storage (S3 / GCS / Azure Blob)",
];

const generated: string[] = [
  "Local Docker Compose (Postgres, Redis, Kong, MinIO)",
  "Kong gateway routes from OpenAPI specs",
  "Terraform for GCP, AWS, or Azure",
  "GitHub Actions CI/CD workflows",
  "Cloud secrets, DNS, WAF",
];

function Column({ title, subtitle, items }: ColumnProps) {
  return (
    <div
      style={{
        borderRadius: "12px",
        background: "var(--rp-c-bg-soft)",
        border: "1px solid var(--rp-c-divider)",
        padding: "1.5rem 1.5rem 1.75rem",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "var(--rp-c-text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.35rem",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "0.92rem",
          color: "var(--rp-c-text-2)",
          marginBottom: "1.1rem",
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        {subtitle}
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: "0.7rem",
        }}
      >
        {items.map((item) => (
          <li
            key={item}
            style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr",
              gap: "0.65rem",
              alignItems: "start",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              color: "var(--rp-c-text-1)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--rp-c-brand)",
                marginTop: "0.55rem",
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TwoLayers() {
  return (
    <div
      style={{
        maxWidth: "1024px",
        margin: "0 auto",
        padding: "2rem 1.5rem 3rem",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          fontWeight: 700,
          color: "var(--rp-c-text-1)",
          margin: "0 0 0.5rem",
        }}
      >
        What you get
      </h2>
      <p
        style={{
          textAlign: "center",
          fontSize: "1.05rem",
          color: "var(--rp-c-text-2)",
          margin: "0 auto 2rem",
          maxWidth: "720px",
          lineHeight: 1.55,
        }}
      >
        Two layers, both driven by one config: a runtime library you import into your services, and infrastructure files the CLI generates for local and cloud.
      </p>
      <div
        className="two-layers"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem",
        }}
      >
        <Column
          title="Runtime modules"
          subtitle="@tsdevstack/nest-common"
          items={runtime}
        />
        <Column
          title="Generated infrastructure"
          subtitle="From config.json + infrastructure.json"
          items={generated}
        />
      </div>
      <style>{`
        @media (max-width: 768px) {
          .two-layers {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
