"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

export function SiteIntro() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const startPath = useRef(pathname);
  const dismiss = useCallback(() => {
    document.documentElement.removeAttribute("data-intro");
    setDismissed(true);
  }, []);

  useEffect(() => {
    // Only the pre-paint script can opt in. Client navigation never starts an intro, and leaving
    // the page mid-intro ends it.
    if (!document.documentElement.dataset.intro) {
      setDismissed(true);
      return;
    }
    if (pathname !== startPath.current) {
      dismiss();
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motion.matches) dismiss();
    };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", dismiss, { passive: true });
    window.addEventListener("wheel", dismiss, { passive: true });
    motion.addEventListener("change", onMotionChange);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("wheel", dismiss);
      // Listeners only: React may re-run this effect (Strict Mode does in development), and the
      // intro must survive that. Ending it is dismiss()'s job, or the head timer's.
      motion.removeEventListener("change", onMotionChange);
    };
  }, [pathname, dismiss]);

  if (dismissed || !["/", "/index", "/opening_animation_video"].includes(pathname)) return null;

  return (
    <div
      className="site-welcome"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.animationName === "welcome-exit") dismiss();
      }}
    >
      <span className="welcome-panel welcome-panel-top" />
      <span className="welcome-panel welcome-panel-bottom" />
      <div className="welcome-scene">
        <div className="welcome-emblem">
          <svg viewBox="0 0 124 120" focusable="false">
            <path className="welcome-hex" pathLength={1} d="M60 14 L99.8 37 L99.8 83 L60 106 L20.2 83 L20.2 37 Z" />
            <path className="welcome-circuit" pathLength={1} d="M86 30 L97 20 H108" />
            <path className="welcome-circuit welcome-circuit-2" pathLength={1} d="M93 44 L104 34 H113" />
            <circle className="welcome-node" cx="111.5" cy="20" r="3.5" />
            <circle className="welcome-node welcome-node-2" cx="116.5" cy="34" r="3.5" />
            <path className="welcome-t" d="M38 40 H82 V53 H66.5 V88 H53.5 V53 H38 Z" />
          </svg>
          <span className="welcome-pulse" />
        </div>
        <span className="welcome-wordmark">
          {"TechJest".split("").map((letter, i) => (
            <span key={i} style={{ "--l": i } as CSSProperties}>
              {letter}
            </span>
          ))}
          <span className="welcome-dot">.</span>
        </span>
        <span className="welcome-rule" />
        <span className="welcome-tagline">
          <span>Ideas today.</span> <span>Solutions tomorrow.</span>
        </span>
      </div>
      <div className="welcome-progress">
        <span className="welcome-bar" />
      </div>
    </div>
  );
}
