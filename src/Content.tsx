import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeCard } from './sanitize';
import { typeset, clearMath } from './math';
export default function Content({
  source,
  className = '',
}: {
  source: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => sanitizeCard(source), [source]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = ref.current!;
    let active = true;
    element.innerHTML = html;
    setError(false);
    if (/\\[([]/.test(source))
      typeset(element, html, () => active).catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      clearMath(element);
    };
  }, [html, source]);
  return (
    <>
      <div ref={ref} className={`card-content ${className}`} />
      {error && (
        <span className="math-error">Math preview unavailable. Original source is shown.</span>
      )}
    </>
  );
}
