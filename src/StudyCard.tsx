import { useEffect, useRef, useState } from 'react';
import type { Card } from '../shared/types';
import Content from './Content';
export default function StudyCard({
  card,
  flipped,
  animate,
  onFlip,
}: {
  card: Card;
  flipped: boolean;
  animate: boolean;
  onFlip: () => void;
}) {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const front = useRef<HTMLDivElement>(null),
    back = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(m.matches);
    m.addEventListener('change', change);
    return () => m.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const hidden = flipped ? front.current : back.current;
    if (hidden?.contains(document.activeElement))
      (flipped ? back.current : front.current)?.focus({ preventScroll: true });
  }, [flipped]);
  const animated = animate && !reduced;
  return (
    <div className="card-slot">
      <div
        onClick={onFlip}
        className={`study-card flip-stage ${animated ? 'animate-flips' : ''} ${flipped ? 'is-flipped' : ''}`}
      >
        <div className="flip-rotor">
          {(['front', 'back'] as const).map((side) => {
            const active = (side === 'back') === flipped;
            return (
              <div
                key={side}
                ref={side === 'front' ? front : back}
                className={`study-face study-${side}`}
                role="button"
                aria-label="Flip card"
                aria-hidden={!active}
                inert={!active}
                tabIndex={active ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.repeat && !e.defaultPrevented) {
                    e.preventDefault();
                    onFlip();
                  }
                }}
              >
                <span className="side-label">
                  {side === 'front' ? 'FRONT · QUESTION' : 'BACK · ANSWER'}
                </span>
                <div
                  className="study-scroll"
                  role="region"
                  aria-label="Card content"
                  tabIndex={active ? 0 : -1}
                >
                  <Content source={card[side]} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
