import { enableVisualEditing } from "@sanity/visual-editing";
import { useEffect } from "react";

type HistoryUpdate =
  | { type: "push"; url: string }
  | { type: "replace"; url: string }
  | { type: "pop" };

/** Connects the deployed preview iframe to Sanity Presentation when enabled. */
export function VisualEditingBridge({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return undefined;

    return enableVisualEditing({
      history: {
        subscribe: (navigate) => {
          const handlePopState = () => {
            navigate({
              type: "push",
              url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
            });
          };

          window.addEventListener("popstate", handlePopState);
          return () => window.removeEventListener("popstate", handlePopState);
        },
        update: (update: HistoryUpdate) => {
          switch (update.type) {
            case "push":
              window.history.pushState(null, "", update.url);
              window.dispatchEvent(new PopStateEvent("popstate"));
              return;
            case "replace":
              window.history.replaceState(null, "", update.url);
              window.dispatchEvent(new PopStateEvent("popstate"));
              return;
            case "pop":
              window.history.back();
              return;
          }
        },
      },
      refresh: () => {
        window.location.reload();
        return Promise.resolve();
      },
    });
  }, [enabled]);

  return null;
}
