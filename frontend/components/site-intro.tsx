"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SiteIntro() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const dismiss = useCallback(() => {
    document.documentElement.removeAttribute("data-intro");
    setDismissed(true);
  }, []);

  useEffect(() => {
    // Only the pre-paint script can opt in. Client navigation never starts an intro.
    if (document.documentElement.dataset.intro !== "play") {
      setDismissed(true);
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
      motion.removeEventListener("change", onMotionChange);
      document.documentElement.removeAttribute("data-intro");
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
      <div className="welcome-brand">
        <span className="welcome-wordmark">
          TechJest<span>.</span>
        </span>
        <span className="welcome-rule" />
        <span className="welcome-tagline">Ideas today. Solutions tomorrow.</span>
      </div>
    </div>
  );
}
