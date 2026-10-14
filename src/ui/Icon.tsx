/**
 * The app's line icons: a 24 grid, a 1.8 stroke, round caps, drawn in `currentColor` so a
 * button's text colour is its icon's colour.
 *
 * Each icon is one path, so the set is data rather than a component per glyph. Stored data
 * never holds an icon; a row's icon comes from its type (`categories.ts`).
 */

const PATHS = {
  all: 'M5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4zM15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3A1.5 1.5 0 0 1 15.5 4zM5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14zM15.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5z',
  note: 'M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7zM14 3v4h4M9 12.5h6M9 16h4',
  todo: 'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zM8.5 12l2.5 2.5 4.5-5',
  contact: 'M12 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5',
  grocery:
    'M4 9h16l-1.6 10.2A2 2 0 0 1 16.4 21H7.6a2 2 0 0 1-2-1.8zM8.5 9 12 3.5 15.5 9M9.5 13v4M14.5 13v4',
  habit:
    'M12 21c-3.6 0-6-2.5-6-5.8 0-3.6 2.7-5.2 3.7-8.7 1.3 1.3 2 2.6 2.2 4.1 1.5-1.6 2.5-4.2 2.3-7.6 2.9 2.3 3.8 6.6 3.8 10.6 0 4.3-2.4 7.4-6 7.4zM12 21c-1.5 0-2.5-1-2.5-2.5 0-1.6 1.2-2.4 2.5-4 1.3 1.6 2.5 2.4 2.5 4 0 1.5-1 2.5-2.5 2.5z',
  flame:
    'M12 21c-3.6 0-6-2.5-6-5.8 0-3.6 2.7-5.2 3.7-8.7 1.3 1.3 2 2.6 2.2 4.1 1.5-1.6 2.5-4.2 2.3-7.6 2.9 2.3 3.8 6.6 3.8 10.6 0 4.3-2.4 7.4-6 7.4z',
  recipe:
    'M3 11h18M5 11v3.5A5.5 5.5 0 0 0 10.5 20h3a5.5 5.5 0 0 0 5.5-5.5V11M9.5 7.5c0-1.2 1-1.5 1-3M13.5 7.5c0-1.2 1-1.5 1-3',
  reading:
    'M12 6.5C9.5 4.8 6.3 4.4 3.5 5.3v13.2c2.8-.9 6-.5 8.5 1.2 2.5-1.7 5.7-2.1 8.5-1.2V5.3c-2.8-.9-6-.5-8.5 1.2zM12 6.5v13.2',
  place:
    'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  routine: 'M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
  workout: 'M3 12h4l2.5-6 5 12 2.5-6h4',
  exercise:
    'M9.5 9V7.5a2.5 2.5 0 0 1 5 0V9M7.5 9h9a5 5 0 0 1 1.2 4.2c-.4 2.6-1.8 4.6-3.2 5.8H9.5c-1.4-1.2-2.8-3.2-3.2-5.8A5 5 0 0 1 7.5 9z',
  search: 'M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM20 20l-4.4-4.4',
  more: 'M12 5.5v.01M12 12v.01M12 18.5v.01',
  tag: 'M9 4 7 20M17 4l-2 16M4.5 9h15M3.5 15h15',
  send: 'M12 19V5M6 11l6-6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  chevronDown: 'M6 9l6 6 6-6',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  trash:
    'M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.1A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.9L17.5 7M10 11v6M14 11v6',
  restore: 'M4 4v5h5M4.6 9A8 8 0 1 1 4 13',
  backup:
    'M12 3v11M7.5 9.5 12 14l4.5-4.5M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15',
  here: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 2v3M12 19v3M2 12h3M19 12h3',
  external:
    'M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  plus: 'M12 5v14M5 12h14',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Rendered size in CSS pixels; the drawing stays on its 24 grid. */
  size?: number;
  /** A label makes the icon an image to assistive technology; without one it is decoration. */
  label?: string;
}

export function Icon({ name, size = 22, label }: IconProps) {
  const a11y =
    label === undefined ? { 'aria-hidden': true } : { role: 'img' as const, 'aria-label': label };
  return (
    <svg
      class={name === 'more' ? 'icon icon--dots' : 'icon'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...a11y}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
