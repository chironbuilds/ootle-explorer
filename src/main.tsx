import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App, { preloadRoutes } from "./App";
import "./index.css";
// Self-hosted fonts (latin subset): no third-party stylesheet blocking first paint, and the files are
// cached forever alongside the app's own assets.
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      // This app only ever does read-only GETs against a public API, so there's nothing to
      // protect by pausing on the browser's self-reported online status (`navigator.onLine`) --
      // that signal is unreliable in some environments and, unlike mutations, a paused GET has no
      // downside from just letting the fetch itself fail and surface as a normal query error.
      networkMode: "always",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// Warm every page chunk once the browser is idle after first paint.
const idle: (cb: () => void) => void = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
window.addEventListener("load", () => idle(preloadRoutes));
