try {
  if (localStorage.getItem("oneview-theme") === "dark") {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
