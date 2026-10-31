"use client";

import { useEffect } from "react";

// Pointer-driven 3D, site-wide. It only writes CSS variables; globals.css turns them into
// perspective tilts. The hero headline leans toward the pointer, and cards tilt under it with a
// soft glare. Mouse and pen only, and never with reduced motion: html.depth-on gates the CSS.

const CARDS =
  ".service-card, .process-step, .project-blueprint, .work-spotlight, .cta-row, .market-service-card, .project, .side-block";

export function Depth3D() {
  useEffect(() => {
    const allowed = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const root = document.documentElement;
    let card: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const release = (element: HTMLElement | null) => {
      if (!element) return;
      element.classList.remove("is-tilting");
      for (const name of ["--rx", "--ry", "--tx", "--ty"]) element.style.removeProperty(name);
    };

    const update = () => {
      frame = 0;
      const event = last;
      if (!event) return;
      const hero = document.querySelector<HTMLElement>(".hero-bold");
      if (hero) {
        const bounds = hero.getBoundingClientRect();
        if (bounds.bottom > 0) {
          hero.style.setProperty("--mx", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
          hero.style.setProperty("--my", (((event.clientY - bounds.top) / bounds.height) * 2 - 1).toFixed(3));
        }
      }
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(CARDS) : null;
      if (target !== card) {
        release(card);
        card = target;
      }
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      const x = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
      const y = Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
      // Big panels tilt less than small cards so they never feel seasick.
      const strength = bounds.width > 700 ? 2.5 : 6;
      card.classList.add("is-tilting");
      card.style.setProperty("--rx", `${((0.5 - y) * strength).toFixed(2)}deg`);
      card.style.setProperty("--ry", `${((x - 0.5) * strength).toFixed(2)}deg`);
      card.style.setProperty("--tx", `${(x * 100).toFixed(1)}%`);
      card.style.setProperty("--ty", `${(y * 100).toFixed(1)}%`);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeave = () => {
      release(card);
      card = null;
    };

    const enable = () => {
      if (!allowed.matches) return disable();
      root.classList.add("depth-on");
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    };
    const disable = () => {
      root.classList.remove("depth-on");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      frame = 0;
      onLeave();
    };

    enable();
    allowed.addEventListener("change", enable);
    return () => {
      allowed.removeEventListener("change", enable);
      disable();
    };
  }, []);

  return null;
}
