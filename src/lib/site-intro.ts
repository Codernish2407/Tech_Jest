// The opening animation: a two-second brand reveal on the homepage, once per tab. No video or
// scroll lock. "play" holds the page's own entrance animations; at "exit" the curtain opens and
// they start underneath. The head timers clear it even if hydration fails or animation events never fire.
export const introScript = `(() => {
  const root = document.documentElement;
  try {
    if (!['/', '/opening_animation_video'].includes(location.pathname) || location.hash) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent)) return;
    const replay = new URLSearchParams(location.search).get('intro') === '1';
    try {
      if (!replay && sessionStorage.getItem('techjest-welcome-v2')) return;
      sessionStorage.setItem('techjest-welcome-v2', 'seen');
    } catch { /* Storage is optional; the greeting still expires. */ }
    root.dataset.intro = 'play';
    setTimeout(() => { if (root.dataset.intro) root.dataset.intro = 'exit'; }, 1600);
    setTimeout(() => root.removeAttribute('data-intro'), 2300);
  } catch {
    root.removeAttribute('data-intro');
  }
})();`;
