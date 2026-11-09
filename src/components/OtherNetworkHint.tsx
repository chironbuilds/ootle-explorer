import { useLocation } from "react-router-dom";
import { HAS_OTHER_EXPLORER, OTHER_EXPLORER } from "../lib/network";

/** Shown when a lookup fails: old links and pasted ids often belong to the other network. */
export function OtherNetworkHint() {
  const { pathname } = useLocation();
  if (!HAS_OTHER_EXPLORER) return null;
  return (
    <p className="mt-4 text-center text-xs text-ink-faint">
      From the other network?{" "}
      <a href={OTHER_EXPLORER.url + pathname} className="text-accent hover:text-accent-strong">
        Open this on the {OTHER_EXPLORER.label}
      </a>
      .
    </p>
  );
}
