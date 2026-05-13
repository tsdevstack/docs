interface BlogPost {
  slug: string;
  title: string;
  date: string;
  description: string;
  cover: string;
}

interface BlogPostListProps {
  posts: BlogPost[];
}

export function BlogPostList({ posts }: BlogPostListProps) {
  return (
    <div
      className="blog-post-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '900px',
        margin: '2rem auto 4rem',
        padding: '0 1.5rem',
      }}
    >
      {posts.map((post) => (
        <a
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="blog-post-card"
          style={{
            display: 'flex',
            gap: '1.5rem',
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'var(--rp-c-bg-soft)',
            border: '1px solid var(--rp-c-divider)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'border-color 0.2s, transform 0.2s',
          }}
        >
          <div
            className="blog-post-cover"
            style={{
              flex: '0 0 200px',
              aspectRatio: '16 / 9',
              borderRadius: '8px',
              overflow: 'hidden',
              background: 'var(--rp-c-bg-mute)',
            }}
          >
            <img
              src={post.cover}
              alt=""
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
            }}
          >
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 600,
                margin: '0 0 0.35rem',
                color: 'var(--rp-c-text-1)',
                lineHeight: 1.35,
              }}
            >
              {post.title}
            </h3>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--rp-c-text-3)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {post.date}
            </div>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--rp-c-text-2)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {post.description}
            </p>
          </div>
        </a>
      ))}
      <style>{`
        .blog-post-card:hover {
          border-color: var(--rp-c-brand) !important;
        }
        @media (max-width: 640px) {
          .blog-post-card {
            flex-direction: column !important;
          }
          .blog-post-cover {
            flex: 0 0 auto !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
