export function SocialLinks() {
  const links = [
    { label: 'GitHub', href: 'https://github.com/tsdevstack' },
    { label: 'npm', href: 'https://www.npmjs.com/org/tsdevstack' },
    { label: 'Discord', href: 'https://discord.gg/2EMFkqc8QR' },
    { label: 'X', href: 'https://x.com/tsdevstack' },
    { label: 'Medium', href: 'https://medium.com/@kram.gyorgy' },
  ];

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '1.5rem',
      padding: '1rem 1.5rem 3rem',
      flexWrap: 'wrap',
    }}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.9rem',
            fontWeight: 500,
            color: 'var(--rp-c-text-2)',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
