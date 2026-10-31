"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categories, formatPrice, type Service } from "@/frontend/data/services";
import { ServiceIcon } from "@/frontend/components/icons";
import { AddToCartButton, CartSummary, getCart } from "@/frontend/components/service-cart";
import { Scene3D } from "./scene-3d";
import { RiseTitle } from "./hero-title";

export function ServiceMarketplace({
  services: initialServices,
  unavailable: initiallyUnavailable = false,
}: {
  services: Service[];
  unavailable?: boolean;
}) {
  const [recoveredServices, setRecoveredServices] = useState<Service[] | null>(null);
  const [retrying, setRetrying] = useState(false);
  const services = recoveredServices ?? initialServices;
  const unavailable = initiallyUnavailable && recoveredServices === null;
  async function retryCatalog() {
    if (retrying) return;
    setRetrying(true);
    try {
      const response = await fetch("/api/services", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (Array.isArray(data)) setRecoveredServices(data as Service[]);
    } catch {
      // Keep the outage state and its contact alternative available.
    } finally {
      setRetrying(false);
    }
  }
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState("popular");
  const [cartSlugs, setCartSlugs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setCartSlugs(getCart());
    sync();
    window.addEventListener("techjest-cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("techjest-cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const popularServices = useMemo(() => services.filter((item) => item.popular), [services]);
  const selected = useMemo(() => services.filter((item) => cartSlugs.includes(item.slug)), [cartSlugs, services]);
  const filtered = useMemo(
    () =>
      services
        .filter((item) => {
          const matchesCategory = category === "All" || item.category === category;
          const text = `${item.name} ${item.description} ${item.category}`.toLowerCase();
          return matchesCategory && text.includes(query.toLowerCase().trim());
        })
        .sort((a, b) =>
          sort === "price"
            ? (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
            : sort === "name"
              ? a.name.localeCompare(b.name)
              : Number(Boolean(b.popular)) - Number(Boolean(a.popular)),
        ),
    [category, query, services, sort],
  );
  return (
    <>
      <section className="marketplace-hero">
        <div className="container">
          <div className="eyebrow">Build your project</div>
          <RiseTitle text="Technology services, selected for your next move." />
          <p className="lead">
            Explore individual services, combine what you need into a project package, and request a clear quote from
            the TechJest team.
          </p>
          <div className="marketplace-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              disabled={unavailable}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services, solutions, or integrations..."
              aria-label="Search services"
            />
          </div>
        </div>
        <Scene3D variant="services" className="page-hero-scene" />
      </section>
      <section className="section marketplace-section">
        <div className="container">
          {unavailable ? (
            <div className="catalog-notice" role="status">
              <h2>We couldn’t load the service catalog.</h2>
              <p>
                Please try again in a moment. You can still tell us about your project and we’ll help you choose the
                right services.
              </p>
              <div className="hero-actions">
                <button type="button" className="btn btn-primary" onClick={retryCatalog} disabled={retrying}>
                  {retrying ? "Checking services…" : "Try again"}
                </button>
                <Link className="btn btn-ghost" href="/contact">
                  Discuss your project
                </Link>
              </div>
            </div>
          ) : (
            <>
              {selected.length > 0 && (
                <div className="marketplace-selection">
                  <p>
                    <strong>
                      {selected.length} service{selected.length === 1 ? "" : "s"} selected
                    </strong>
                    <br />
                    Review your package before requesting a quote.
                  </p>
                  <Link className="btn btn-primary" href="/cart">
                    Review project cart
                  </Link>
                </div>
              )}
              <div className="marketplace-layout">
                <div>
                  <div className="marketplace-toolbar">
                    <div role="status" aria-live="polite" aria-atomic="true">
                      <strong>{filtered.length} services</strong>
                      <span> available for your project</span>
                    </div>
                    <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort services">
                      <option value="popular">Sort: Popular</option>
                      <option value="price">Sort: Starting price</option>
                      <option value="name">Sort: Name (A–Z)</option>
                    </select>
                  </div>
                  <div className="category-list">
                    {categories.map((item) => (
                      <button
                        type="button"
                        aria-pressed={category === item}
                        className={category === item ? "active" : ""}
                        key={item}
                        onClick={() => setCategory(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {(query || category !== "All") && (
                    <button
                      className="filter-reset"
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCategory("All");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                  <div className="service-market-grid">
                    {filtered.map((item) => (
                      <article className="market-service-card" key={item.slug}>
                        <div className="market-service-icon">
                          <ServiceIcon category={item.category} />
                        </div>
                        <div className="market-service-meta">
                          <span>{item.category}</span>
                          <span>{item.delivery}</span>
                        </div>
                        <h2>{item.name}</h2>
                        <p>{item.description}</p>
                        <div className="market-service-price">{formatPrice(item.price)}</div>
                        <div className="market-service-actions">
                          <Link className="btn btn-ghost" href={`/services/${item.slug}`}>
                            View details
                          </Link>
                          <AddToCartButton service={item} />
                        </div>
                      </article>
                    ))}
                  </div>
                  {!filtered.length && (
                    <div className="empty-state">
                      <h2>{services.length ? "No services found." : "No services listed right now."}</h2>
                      <p>
                        {services.length
                          ? "Try another search or browse all categories."
                          : "Tell us what you need and we’ll help scope your project."}
                      </p>
                      {services.length ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setQuery("");
                            setCategory("All");
                          }}
                        >
                          Show all services
                        </button>
                      ) : (
                        <Link className="btn btn-primary" href="/contact">
                          Discuss your project
                        </Link>
                      )}
                    </div>
                  )}
                </div>
                <aside>
                  <div className="popular-panel">
                    <div className="eyebrow">Popular services</div>
                    <h2>Common starting points.</h2>
                    {popularServices.slice(0, 6).map((item) => (
                      <Link href={`/services/${item.slug}`} key={item.slug}>
                        <span>
                          <ServiceIcon category={item.category} />
                        </span>
                        <strong>{item.name}</strong>
                        <small>{formatPrice(item.price)}</small>
                      </Link>
                    ))}
                  </div>
                  {selected.length > 0 && <CartSummary services={selected} />}
                </aside>
              </div>
            </>
          )}
        </div>
      </section>
      <section className="section marketplace-cta">
        <div className="container cta-row">
          <div>
            <div className="eyebrow">Need something different?</div>
            <h2>Can’t find the right service?</h2>
            <p className="lead">Tell us what you need and we’ll shape a custom solution around your business.</p>
          </div>
          <Link className="btn btn-primary" href="/contact">
            Request custom solution
          </Link>
        </div>
      </section>
    </>
  );
}
