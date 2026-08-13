// Applied before first paint so neither the theme nor the sidebar width
// flashes its default before the stored preference loads. Kept as one
// external file (not inline) so the CSP's script-src needs no
// 'unsafe-inline'.
try {
  var saved = localStorage.getItem("oneview-theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}

try {
  // The width lives on <html> rather than in React state because the page
  // content's left padding depends on it, and that padding is applied by
  // server-rendered layouts that can't read client state.
  if (localStorage.getItem("oneview-sidebar") === "collapsed") {
    document.documentElement.setAttribute("data-sidebar", "collapsed");
  }
} catch (e) {}
