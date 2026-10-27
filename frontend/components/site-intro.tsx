"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

// Runs in <head> before the first paint, so the video intro never flashes in late.
// It sets up the intro state on the opening page (home route '/'), never for reduced-motion users or crawlers.
export const introScript = `(() => {
  const root = document.documentElement;
  try {
    const p = location.pathname;
    const isOpening = p === '/' || p === '' || p === '/opening_animation_video';
    if (!isOpening) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent)) return;
    root.dataset.intro = "play";
    root.classList.add("intro-active");
    if (document.body) {
      document.body.classList.add("intro-active");
    }
  } catch {
    return;
  }
})();`;

// The only pages the intro can play on. On Vercel the cached homepage is rendered with the path "/index"
// while the browser sees "/"; both must render the overlay, or React reports a hydration mismatch (#418).
function isIntroPage(pathname: string) {
  return pathname === "/" || pathname === "/index" || pathname === "/opening_animation_video";
}

export function SiteIntro() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);
  const [active, setActive] = useState(true);

  const revealWebsite = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    const loader = loaderRef.current;
    if (loader) {
      loader.classList.add("fade-out");
    }

    document.documentElement.classList.remove("intro-active");
    document.body.classList.remove("intro-active");
    document.body.classList.add("loaded");

    // Pause video and hide overlay from DOM after fade finishes to save memory/GPU
    setTimeout(() => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {
          // ignore
        }
      }
      if (loader) {
        loader.style.display = "none";
      }
      document.documentElement.removeAttribute("data-intro");
      setActive(false);
    }, 1200);
  }, []);

  useEffect(() => {
    // Client navigation must not hide the site again after the overlay is dismissed.
    if (revealedRef.current) return;
    // Only play on the opening pages ("/?intro=1" replays it on the homepage).
    if (!isIntroPage(pathname)) {
      revealWebsite();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealWebsite();
      return;
    }

    if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent)) {
      revealWebsite();
      return;
    }

    document.documentElement.classList.add("intro-active");
    document.body.classList.add("intro-active");
    document.documentElement.dataset.intro = "play";

    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser policy blocks autoplay, reveal site so user is not stuck
          revealWebsite();
        });
      }
    }

    // Safety fallback timer (14 seconds) in case video stalls on a slow connection
    const fallbackTimer = setTimeout(revealWebsite, 14000);

    // Keyboard support: Escape, Space, or Enter skips the intro
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        revealWebsite();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pathname, revealWebsite]);

  // Other pages never render the overlay, so their visitors do not download the 5 MB video.
  if (!active || !isIntroPage(pathname)) return null;

  return (
    <div id="intro-loader" ref={loaderRef} aria-label="TechJest opening animation">
      {/* 
        muted + playsinline are required by modern browsers (Chrome, Safari, iOS) 
        to allow videos to autoplay without user interaction.
      */}
      <video
        ref={videoRef}
        id="intro-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={revealWebsite}
        onError={revealWebsite}
      >
        <source src="/opening_animation_video.mp4" type="video/mp4" />
        Your browser does not support HTML5 video.
      </video>

      <button id="skip-btn" type="button" onClick={revealWebsite} aria-label="Skip introduction video">
        Skip Intro
      </button>

      {/* Immediate early listener script before hydration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(() => {
            const loader = document.getElementById('intro-loader');
            const video = document.getElementById('intro-video');
            const skip = document.getElementById('skip-btn');
            function reveal() {
              if (!loader || loader.classList.contains('fade-out')) return;
              loader.classList.add('fade-out');
              document.body.classList.remove('intro-active');
              document.documentElement.classList.remove('intro-active');
              document.body.classList.add('loaded');
              setTimeout(() => {
                if (video) { try { video.pause(); } catch(e){} }
                loader.style.display = 'none';
                document.documentElement.removeAttribute('data-intro');
              }, 1200);
            }
            if (video) {
              video.addEventListener('ended', reveal);
              video.addEventListener('error', reveal);
            }
            if (skip) {
              skip.addEventListener('click', reveal);
            }
            setTimeout(reveal, 14000);
          })();`,
        }}
      />
    </div>
  );
}
