(() => {
  const refreshParameter = "_gallery_studio_refresh";
  const initialUrl = new URL(window.location.href);
  const attemptedEntry = initialUrl.searchParams.get(refreshParameter);
  if (attemptedEntry !== null) {
    initialUrl.searchParams.delete(refreshParameter);
    window.history.replaceState(window.history.state, "", initialUrl);
  }

  const studioEntry = (page) => page.querySelector('script[type="module"][src^="/static/sanity-"]')?.getAttribute("src");
  let lastCheck = -Infinity;

  async function recoverIfStudioChanged() {
    const current = studioEntry(document);
    if (!current || current === attemptedEntry || Date.now() - lastCheck < 5_000) return;
    lastCheck = Date.now();

    const path = window.location.pathname;
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok || window.location.pathname !== path) return;
      const updated = studioEntry(new DOMParser().parseFromString(await response.text(), "text/html"));
      if (!updated || updated === current || window.location.pathname !== path) return;

      const destination = new URL(window.location.href);
      destination.searchParams.set(refreshParameter, current);
      window.location.replace(destination);
    } catch {
      // Let Studio show its reload control if the current release cannot be checked.
    }
  }

  function isImportError(error) {
    const message = typeof error === "string" ? error : error?.message;
    return typeof message === "string" && /importing a module script failed|dynamically imported module|error loading module script/i.test(message);
  }

  window.addEventListener("vite:preloadError", recoverIfStudioChanged);
  window.addEventListener("error", (event) => {
    const failedEntry = event.target instanceof HTMLScriptElement && event.target.getAttribute("src") === studioEntry(document);
    if (failedEntry || isImportError(event.error)) void recoverIfStudioChanged();
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    if (isImportError(event.reason)) void recoverIfStudioChanged();
  });
})();
