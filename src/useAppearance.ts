import { useEffect, useRef, useState } from 'react';
import { normalizeAppearance, accentVariables, type Appearance } from '../shared/appearance';
export function useAppearance() {
  const [appearance, setAppearance] = useState(() => {
    try {
      return normalizeAppearance(
        JSON.parse(localStorage.getItem('appearance:v1') || 'null'),
        localStorage.getItem('theme'),
      );
    } catch {
      return normalizeAppearance(null, localStorage.getItem('theme'));
    }
  });
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState('');
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    window.supercard
      .loadAppearance()
      .then((saved) => {
        if (!alive) return;
        if (saved) setAppearance(saved);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) {
          setError(
            'Appearance settings could not be loaded. Your saved preferences have not been replaced.',
          );
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = appearance.theme;
    root.style.setProperty('--card-font-size', `${appearance.cardFontSize}px`);
    for (const [key, value] of Object.entries(accentVariables(appearance)))
      root.style.setProperty(key, value);
    if (!loaded) return;
    localStorage.setItem('appearance:v1', JSON.stringify(appearance));
    localStorage.setItem('theme', appearance.theme);
    queue.current = queue.current
      .catch(() => {})
      .then(() => window.supercard.saveAppearance(appearance))
      .then(() => {
        setError('');
      })
      .catch(() => {
        setError(
          'Appearance could not be saved to the database. The local recovery copy is retained.',
        );
      });
  }, [appearance, loaded]);
  return {
    appearance,
    loaded,
    error,
    update: (patch: Partial<Appearance>) =>
      setAppearance((old) => normalizeAppearance({ ...old, ...patch })),
    flush: () => queue.current,
  };
}
