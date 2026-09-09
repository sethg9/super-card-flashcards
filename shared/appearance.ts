import { MANAGED_IMAGE } from './images';
export type Theme = 'light' | 'dark' | 'oled';
export interface Appearance {
  version: 1;
  theme: Theme;
  accent: string;
  background: string | null;
  dimming: number;
  animateFlips: boolean;
}
export const DEFAULT_ACCENT = '#78f542';
export const DEFAULT_APPEARANCE: Appearance = {
  version: 1,
  theme: 'light',
  accent: DEFAULT_ACCENT,
  background: null,
  dimming: 0.65,
  animateFlips: true,
};
export function normalizeAppearance(value: unknown, legacyTheme?: string | null): Appearance {
  const v = value && typeof value === 'object' ? (value as Partial<Appearance>) : {};
  const theme = v.theme ?? legacyTheme;
  return {
    version: 1,
    theme: theme === 'dark' || theme === 'oled' ? theme : 'light',
    accent:
      typeof v.accent === 'string' && /^#[\da-f]{6}$/i.test(v.accent)
        ? v.accent.toLowerCase()
        : DEFAULT_ACCENT,
    background:
      typeof v.background === 'string' && MANAGED_IMAGE.test(v.background) ? v.background : null,
    dimming:
      typeof v.dimming === 'number' && Number.isFinite(v.dimming)
        ? Math.min(0.95, Math.max(0, v.dimming))
        : 0.65,
    animateFlips: typeof v.animateFlips === 'boolean' ? v.animateFlips : true,
  };
}
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function mix(a: string, b: string, amount: number) {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function readable(color: string, surfaces: string[], minimum: number) {
  const score = (c: string) => Math.min(...surfaces.map((s) => contrast(c, s)));
  const target = score('#000000') >= score('#ffffff') ? '#000000' : '#ffffff';
  for (let n = 0; n <= 100; n++) {
    const candidate = mix(color, target, n / 100);
    if (surfaces.every((surface) => contrast(candidate, surface) >= minimum)) return candidate;
  }
  return target;
}
export function accentVariables(a: Appearance): Record<string, string> {
  const tint = (base: string, strength: number) => mix(base, a.accent, strength);
  const surface =
    a.theme === 'light' ? '#ffffff' : a.theme === 'dark' ? tint('#171717', 0.035) : '#000000';
  const bg =
    a.theme === 'light' ? '#f8f9fc' : a.theme === 'dark' ? tint('#0d0d0d', 0.025) : '#000000';
  const fg = contrast(a.accent, '#000000') >= contrast(a.accent, '#ffffff') ? '#000000' : '#ffffff';
  const hover = mix(a.accent, fg === '#000000' ? '#ffffff' : '#000000', 0.12);
  const pressed = mix(a.accent, fg === '#000000' ? '#ffffff' : '#000000', 0.23);
  const soft = a.theme === 'oled' ? '#000000' : mix(surface, a.accent, 0.1);
  return {
    '--bg': bg,
    '--surface': surface,
    '--sidebar': a.theme === 'dark' ? tint('#111111', 0.03) : surface,
    '--border': a.theme === 'light' ? '#e7e9f1' : tint('#303030', 0.035),
    '--hover': a.theme === 'light' ? '#f2f3f8' : tint('#222222', 0.035),
    '--tag': a.theme === 'light' ? '#f3f4f8' : tint('#222222', 0.035),
    '--accent': a.accent,
    '--accent-fg': fg,
    '--accent-hover': hover,
    '--accent-pressed': pressed,
    '--accent-text': readable(a.accent, [surface, bg, soft], 4.5),
    '--focus': readable(a.accent, [surface, bg, soft], 3),
    '--accent-soft': soft,
    '--banner': soft,
    '--banner-border': mix(surface, a.accent, 0.32),
    '--selection': mix(surface, a.accent, 0.25),
    '--selection-fg': readable(a.accent, [mix(surface, a.accent, 0.25)], 4.5),
  };
}
export function hueHex(hue: number) {
  const h = (((hue % 360) + 360) % 360) / 60,
    x = 1 - Math.abs((h % 2) - 1);
  const rgb =
    h < 1
      ? [1, x, 0]
      : h < 2
        ? [x, 1, 0]
        : h < 3
          ? [0, 1, x]
          : h < 4
            ? [0, x, 1]
            : h < 5
              ? [x, 0, 1]
              : [1, 0, x];
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function hexHue(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  return d === 0
    ? 0
    : ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
}
