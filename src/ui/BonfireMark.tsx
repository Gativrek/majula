/**
 * The app's mark inside the app: the launcher icon's bonfire on its glow, drawn from the
 * same paths as `android/app/src/main/res/drawable/ic_launcher_foreground.xml` so the two
 * never drift apart (DECISIONS.md, 2026-10-14, App icon).
 */

const FLAMES = [
  'M36 82c-5-4-5-10-1-15',
  'M72 82c5-4 5-10 1-15',
  'M47 76c-9-4-10-14-4-22 0 6 3 9 6 11',
  'M61 76c9-4 9-15 2-23 0 6-2 10-5 12',
];

const EMBERS: readonly [number, number, number][] = [
  [38, 46, 1.8],
  [71, 40, 2],
  [66, 27, 1.3],
  [40, 31, 1.3],
  [58, 16, 1],
  [30, 40, 1],
];

export function BonfireMark({ size }: { size: number }) {
  // The launcher shows the middle 72 of the icon's 108 units; so does this.
  return (
    <svg class="bonfire" viewBox="18 18 72 72" width={size} height={size} aria-hidden="true">
      <g
        transform="translate(5.4 5.4) scale(0.9)"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {FLAMES.map((d) => (
          <path key={d} d={d} class="bonfire__flame" />
        ))}
        <path d="M50.5 37h7v34l-3.5 6-3.5-6z" class="bonfire__ground" />
        <path d="M44 36c4-2 16-2 20 0M54 26v8" />
        <circle cx="54" cy="22.5" r="3" />
        <path d="M26 84c6-9 16-12 28-12s22 3 28 12z" class="bonfire__ground" />
        {EMBERS.map(([cx, cy, r]) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} stroke="none" fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}
