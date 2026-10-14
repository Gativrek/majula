import { Icon } from './Icon.tsx';
import type { StarFill } from './rating.ts';

/** One star, full, half or empty. A half star is a full one clipped over an empty one. */
export function Star({ fill, size }: { fill: StarFill; size: number }) {
  return (
    <span class={`star star--${fill}`} style={{ width: size, height: size }}>
      <Icon name="star" size={size} />
      {fill === 'half' ? (
        <span class="star__half">
          <Icon name="star" size={size} />
        </span>
      ) : null}
    </span>
  );
}
