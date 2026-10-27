export function PageLoading({ label = "Loading page" }: { label?: string }) {
  return (
    <section className="section loading-page">
      <div className="container">
        <p className="loading-label" role="status">
          <span className="loading-dot" aria-hidden="true" />
          {label}…
        </p>
        <div className="loading-skeleton" aria-hidden="true">
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-copy" />
          <div className="loading-grid">
            {[0, 1, 2].map((item) => (
              <div className="skeleton skeleton-card" key={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
