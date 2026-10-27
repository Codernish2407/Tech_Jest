"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CartLink } from "@/frontend/components/service-cart";
import { useAccount } from "@/frontend/components/account";
import { CloseIcon, MenuIcon } from "@/frontend/components/icons";

const links: readonly (readonly [string, string])[] = [
  ["Services", "/services"],
  ["Work", "/portfolio"],
  ["About", "/about"],
  ["Contact", "/contact"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { account } = useAccount();
  const signedIn = Boolean(account);
  const admin = account?.admin ?? false;
  const accountLinks: readonly (readonly [string, string])[] = signedIn
    ? [
        [admin ? "Admin console" : "My dashboard", admin ? "/admin" : "/dashboard"],
        ["Messages", admin ? "/admin/messages" : "/messages"],
      ]
    : [["Login", "/auth"]];
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function closeOutside(event: Event) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    const desktop = window.matchMedia("(min-width: 1121px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="mobile-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen(!open)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open && (
        <div
          id="mobile-navigation-panel"
          className="mobile-panel"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
          }}
        >
          <nav aria-label="Mobile navigation">
            {[...links, ...accountLinks].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <CartLink />
          <Link className="btn btn-primary" href="/contact" onClick={() => setOpen(false)}>
            Book a consultation
          </Link>
          {signedIn && (
            <form action="/auth/signout" method="post">
              <button className="text-button" type="submit">
                Log out
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
