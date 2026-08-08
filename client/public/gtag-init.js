// Google Analytics 4 bootstrap (measurement ID G-WJ2Q968GC8).
//
// This lives in a file rather than inline in index.html so the CSP in
// netlify.toml can keep script-src free of 'unsafe-inline' — the loader itself
// is allowlisted by origin, this half is plain 'self'.
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}

// Local development shouldn't land in the property's reports. GA reads this
// flag on every hit, so it must be set before the config call below.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window['ga-disable-G-WJ2Q968GC8'] = true;
}

gtag('js', new Date());
gtag('config', 'G-WJ2Q968GC8');
