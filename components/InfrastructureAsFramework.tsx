interface RowProps {
  label: string;
  body: string;
  emphasized?: boolean;
}

function Row({ label, body, emphasized = false }: RowProps) {
  return (
    <div
      style={{
        padding: "1.1rem 1.5rem",
        borderRadius: "12px",
        background: emphasized
          ? "color-mix(in srgb, var(--rp-c-brand) 8%, transparent)"
          : "var(--rp-c-bg-soft)",
        border: emphasized
          ? "1px solid color-mix(in srgb, var(--rp-c-brand) 35%, transparent)"
          : "1px solid var(--rp-c-divider)",
      }}
    >
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: emphasized ? "var(--rp-c-brand)" : "var(--rp-c-text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1rem",
          lineHeight: 1.55,
          color: "var(--rp-c-text-1)",
          fontWeight: emphasized ? 500 : 400,
        }}
      >
        {body}
      </div>
    </div>
  );
}

export function InfrastructureAsFramework() {
  return (
    <div
      style={{
        maxWidth: "820px",
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
          margin: "0 0 1.5rem",
        }}
      >
        Infrastructure as Framework
      </h2>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <Row
          label="Infrastructure as Code"
          body="Describe cloud resources in files you commit and apply."
        />
        <Row
          label="Platform as a Service"
          body="Hide cloud resources behind a hosted runtime."
        />
        <Row
          label="Infrastructure as Framework"
          body="Declare services and capabilities in one config. The framework generates the infrastructure code, and you own it."
          emphasized
        />
      </div>
      <p
        style={{
          textAlign: "center",
          marginTop: "1.5rem",
          color: "var(--rp-c-text-2)",
          fontSize: "0.95rem",
        }}
      >
        No hosted platform, no vendor lock-in.
      </p>
    </div>
  );
}
