"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Day-to-day work first, then website setup.
const links = [
  ["Overview", "/admin"],
  ["Notifications", "/admin/notifications"],
  ["Messages", "/admin/messages"],
  ["Requests", "/admin/requests"],
  ["CRM", "/admin/crm"],
  ["Proposals", "/admin/proposals"],
  ["Projects", "/admin/projects"],
  ["Invoices", "/admin/invoices"],
  ["People", "/admin/users"],
  ["Services", "/admin/services"],
  ["Website settings", "/admin/settings"],
  ["Activity", "/admin/activity"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const current =
    links.find(([, href]) => href === pathname || (href !== "/admin" && pathname.startsWith(`${href}/`)))?.[1] ??
    "/admin";
  const navRef = useRef<HTMLElement>(null);
  // On phones the menu is one scrolling row; bring the current page's tab into view.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth)
      nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <>
      <label className="admin-mobile-nav">
        <span>Admin workspace</span>
        <select value={current} onChange={(event) => router.push(event.target.value)}>
          {links.map(([label, href]) => (
            <option key={href} value={href}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <nav className="admin-nav" aria-label="Admin navigation" ref={navRef}>
        {links.map(([label, href]) => {
          const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
