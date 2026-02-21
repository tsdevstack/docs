export function Prerequisites() {
  return (
    <div className="prerequisites-box">
      <p><strong>Prerequisites:</strong></p>
      <ul>
        <li>Node.js 20+</li>
        <li>Docker Desktop</li>
        <li>Terraform (for cloud deployment)</li>
      </ul>
      <p>See <a href="/getting-started/prerequisites" style={{ color: 'var(--rp-c-brand)', textDecoration: 'underline' }}>Prerequisites</a> for detailed setup.</p>
    </div>
  );
}