import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

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
