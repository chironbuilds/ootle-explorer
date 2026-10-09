import { useId } from "react";

/** Animated burn marker: three nested flame layers (outer red, mid orange, inner yellow-white core)
 * that flicker out of phase, plus a few embers drifting up, over a pulsing glow. Inline SVG with
 * gradients rather than the emoji so it stays crisp and renders the same on every platform; the
 * motion is CSS (see `.burn-*` in index.css) and collapses to a still flame under reduced-motion. */
export function BurnFlame({ size = 22 }: { size?: number }) {
  const id = useId();
  return (
    <span className="burn-flame" role="img" aria-label="Burn transaction" title="Burn transaction" style={{ width: size * 0.8, height: size }}>
      <svg viewBox="0 0 24 30" width="100%" height="100%" overflow="visible" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-o`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#b3120a" />
            <stop offset="0.55" stopColor="#f2461a" />
            <stop offset="1" stopColor="#ff8a1f" />
          </linearGradient>
          <linearGradient id={`${id}-m`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff7a12" />
            <stop offset="1" stopColor="#ffc233" />
          </linearGradient>
          <linearGradient id={`${id}-c`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffe066" />
            <stop offset="1" stopColor="#fffbe0" />
          </linearGradient>
        </defs>
        <path
          className="burn-layer burn-outer"
          fill={`url(#${id}-o)`}
          d="M12 0.5C12.4 5 16 7.6 18.6 11.6C21.4 15.8 21.6 21.4 18 25.6C16.2 27.7 14.1 28.8 12 28.8C9.9 28.8 7.8 27.7 6 25.6C2.4 21.4 2.6 15.8 5.4 11.6C6.6 9.8 7.7 10.2 8.4 11.6C9.2 8.2 10.9 4.6 12 0.5Z"
        />
        <path
          className="burn-layer burn-mid"
          fill={`url(#${id}-m)`}
          d="M12 10C12.3 13.2 15 15.2 16.4 18C17.8 20.8 17.4 24 15.6 26C14.6 27.1 13.3 27.8 12 27.8C10.7 27.8 9.4 27.1 8.4 26C6.6 24 6.2 20.8 7.6 18C8.5 16.2 9.2 15.4 9.6 13.8C10.4 12.6 11.4 11.6 12 10Z"
        />
        <path
          className="burn-layer burn-core"
          fill={`url(#${id}-c)`}
          d="M12 17.6C12.2 19.6 14.2 21.2 14.2 23.8C14.2 26 13.2 27.3 12 27.3C10.8 27.3 9.8 26 9.8 23.8C9.8 21.2 11.8 19.6 12 17.6Z"
        />
        <circle className="burn-ember burn-ember-a" cx="7" cy="9" r="0.9" fill="#ffb347" />
        <circle className="burn-ember burn-ember-b" cx="17.5" cy="10" r="0.7" fill="#ffd27a" />
        <circle className="burn-ember burn-ember-c" cx="12" cy="6" r="0.6" fill="#ff9a3c" />
      </svg>
    </span>
  );
}
