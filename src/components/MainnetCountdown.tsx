import { useEffect, useState } from "react";
import { INDEXER_URL, NETWORK } from "../lib/network";

const LAUNCH = Date.UTC(2026, 10, 11, 5, 0, 0);
const HOUR = 3_600_000;
const ECLIPSE_SPAN = 72 * HOUR; // the veil starts sliding this long before launch
const SHOW_AFTER_LAUNCH = 72 * HOUR;
const MAINNET_INDEXER_HOST = "indexer-a.ootle.tari.com";
const RELOADED_KEY = "veil-cutover-reloaded";
const WILL_BECOME_MAINNET = typeof location !== "undefined" && location.host === "explorer.tari.mw";

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

/** On explorer.tari.mw, reloads an open page once the server has switched it to the mainnet build. */
export function useCutoverReload() {
  useEffect(() => {
    if (!WILL_BECOME_MAINNET || NETWORK === "mainnet") return;
    let timer: number;
    const check = async () => {
      try {
        const html = await (await fetch("/", { cache: "no-store" })).text();
        if (html.includes(MAINNET_INDEXER_HOST) && !INDEXER_URL.includes(MAINNET_INDEXER_HOST)) {
          // Once only: a stale cached page must not turn this into a reload loop.
          if (sessionStorage.getItem(RELOADED_KEY)) return;
          sessionStorage.setItem(RELOADED_KEY, "1");
          location.reload();
          return;
        }
      } catch {
        // Offline for a moment; the next check tries again.
      }
      timer = window.setTimeout(check, 20_000);
    };
    timer = window.setTimeout(check, Math.max(0, LAUNCH - Date.now()));
    return () => window.clearTimeout(timer);
  }, []);
}

function Eclipse({ progress, second, launched }: { progress: number; second: number; launched: boolean }) {
  const veilX = 120 + 5 + progress * 76;
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="corona">
          <stop offset="28%" stopColor="var(--reveal)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--reveal)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: 60 }, (_, i) => (
        <line
          key={i}
          x1="120"
          y1="6"
          x2="120"
          y2={i % 5 === 0 ? 17 : 13}
          transform={`rotate(${i * 6} 120 120)`}
          stroke={launched || i <= second ? "var(--accent)" : "var(--border)"}
          strokeWidth={i % 5 === 0 ? 2 : 1.4}
          strokeLinecap="round"
        />
      ))}
      <g className="eclipse-spin">
        <circle cx="120" cy="120" r="92" fill="none" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="5 9" strokeLinecap="round" />
      </g>
      <g className="eclipse-spin-reverse">
        <circle cx="120" cy="120" r="70" fill="none" stroke="var(--veil)" strokeOpacity="0.28" strokeWidth="1" />
        <circle cx="120" cy="50" r="3.5" fill="var(--veil)" />
        <circle cx="190" cy="120" r="2.2" fill="var(--accent)" />
      </g>
      <circle className="eclipse-corona" cx="120" cy="120" r="82" fill="url(#corona)" />
      <circle cx="120" cy="120" r="37" fill="var(--reveal)" />
      {!launched && <circle cx={veilX} cy="120" r="38.5" fill="var(--surface)" stroke="var(--veil)" strokeOpacity="0.45" strokeWidth="1" />}
    </svg>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  const digits = String(value).padStart(2, "0").split("");
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2/70 px-1 py-3 text-center sm:px-3 sm:py-4">
      <div className="flex justify-center overflow-hidden font-display text-[2rem] font-semibold leading-none tabular-nums text-ink sm:text-5xl">
        {digits.map((d, i) => (
          <span key={`${i}-${d}`} className="countdown-digit">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint sm:text-xs">{label}</div>
    </div>
  );
}

export function MainnetCountdown() {
  const now = useNow();
  if (NETWORK !== "esmeralda" || now > LAUNCH + SHOW_AFTER_LAUNCH) return null;

  const left = Math.max(0, Math.ceil((LAUNCH - now) / 1000));
  const launched = left === 0;
  const progress = Math.min(1, Math.max(0, 1 - (LAUNCH - now) / ECLIPSE_SPAN));
  const second = 59 - (left % 60);
  const localTime = new Date(LAUNCH).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <section className="countdown-card relative mb-8 overflow-hidden rounded-2xl border border-border" aria-label="Countdown to Ootle mainnet">
      <div className="relative grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[1fr_230px] lg:gap-10">
        <div className="order-2 min-w-0 md:order-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-[0.16em] text-reveal">
            <span className="h-1.5 w-1.5 rounded-full bg-reveal pulse-dot" />
            11.11 · 11:11 UTC
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {launched ? "Ootle mainnet is launching" : "Ootle mainnet is coming"}
          </h2>

          {launched ? (
            <p className="mt-4 max-w-xl text-sm text-ink-dim">
              {WILL_BECOME_MAINNET ? "This page switches to mainnet by itself as soon as the network is serving." : (
                <>
                  Follow it on the{" "}
                  <a href="https://explorer.tari.mw" className="text-accent hover:text-accent-strong">
                    mainnet explorer
                  </a>
                  .
                </>
              )}
            </p>
          ) : (
            <>
              <div className="mt-5 flex gap-2 sm:gap-3" role="timer" aria-label={`${Math.floor(left / 86400)} days until mainnet`}>
                <Unit value={Math.floor(left / 86400)} label="Days" />
                <Unit value={Math.floor(left / 3600) % 24} label="Hours" />
                <Unit value={Math.floor(left / 60) % 60} label="Min" />
                <Unit value={left % 60} label="Sec" />
              </div>
              <p className="mt-4 text-xs text-ink-dim">
                {localTime} your time.{" "}
                {WILL_BECOME_MAINNET ? "This explorer moves to mainnet at launch; testnet stays at testnet-explorer.tari.mw." : "The mainnet explorer opens at explorer.tari.mw."}
              </p>
            </>
          )}
        </div>
        <div className="order-1 mx-auto h-36 w-36 md:order-2 md:h-[230px] md:w-[230px]">
          <Eclipse progress={launched ? 1 : progress} second={second} launched={launched} />
        </div>
      </div>
    </section>
  );
}
