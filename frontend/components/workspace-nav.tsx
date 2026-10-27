"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="workspace-nav" aria-label="Client workspace">
      <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
        Overview
      </Link>
      <Link href="/messages" aria-current={pathname === "/messages" ? "page" : undefined}>
        Messages
      </Link>
      <Link href="/services">
        Explore services <span aria-hidden="true">↗</span>
      </Link>
    </nav>
  );
}
