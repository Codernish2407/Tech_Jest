// A brief, optional brand greeting. No video, scroll lock, or hidden page content.
// The head timer clears it even if hydration fails or CSS animation events never fire.
export const introScript = `(() => {
  const root = document.documentElement;
  try {
    if (!['/', '/opening_animation_video'].includes(location.pathname) || location.hash) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent)) return;
    const replay = new URLSearchParams(location.search).get('intro') === '1';
    try {
      if (!replay && sessionStorage.getItem('techjest-welcome-v1')) return;
      sessionStorage.setItem('techjest-welcome-v1', 'seen');
    } catch { /* Storage is optional; the greeting still expires. */ }
    root.dataset.intro = 'play';
    setTimeout(() => root.removeAttribute('data-intro'), 1200);
  } catch {
    root.removeAttribute('data-intro');
  }
})();`;
