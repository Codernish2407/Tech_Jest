"use client";

import { useEffect, useRef } from "react";
import type { SceneVariant } from "./scene-3d-world";

// A decorative WebGL scene. three.js and the scene code load only after the page is interactive,
// so they never hold up the first paint; without WebGL the box simply stays empty. With reduced
// motion the scene renders once, standing still.
export function Scene3D({ variant, className }: { variant: SceneVariant; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = () =>
      import("./scene-3d-world")
        .then(({ mountScene }) => {
          if (cancelled) return;
          cleanup = mountScene(element, variant, still);
          element.classList.add("is-ready");
        })
        .catch(() => {
          // WebGL unavailable or blocked: the scene is decorative, so leave the space quiet.
        });
    const idle = "requestIdleCallback" in window ? window.requestIdleCallback(start, { timeout: 1200 }) : 0;
    const timer = idle ? 0 : window.setTimeout(start, 200);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      cleanup?.();
      element.classList.remove("is-ready");
    };
  }, [variant]);

  return <div ref={host} className={`scene-3d${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}
