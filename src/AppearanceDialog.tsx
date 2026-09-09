import { useEffect, useState } from 'react';
import { X, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { DEFAULT_ACCENT, hexHue, hueHex, type Appearance, type Theme } from '../shared/appearance';
import Modal from './Modal';
export default function AppearanceDialog({
  value,
  update,
  onClose,
  saveError,
}: {
  value: Appearance;
  update: (patch: Partial<Appearance>) => void;
  onClose: () => void;
  saveError: string;
}) {
  const [hex, setHex] = useState(value.accent),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [missing, setMissing] = useState(false);
  useEffect(() => setHex(value.accent), [value.accent]);
  useEffect(() => setMissing(false), [value.background]);
  return (
    <Modal
      label="Appearance"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h2>Appearance</h2>
        </div>
        <button aria-label="Close appearance" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {(error || saveError) && (
        <div className="inline-error" role="alert">
          {error || saveError}
        </div>
      )}
      <section className="appearance-section">
        <h3>Theme</h3>
        <div className="theme-choices" role="group" aria-label="Theme">
          {(['light', 'dark', 'oled'] as Theme[]).map((theme) => (
            <button
              key={theme}
              aria-pressed={value.theme === theme}
              onClick={() => update({ theme })}
            >
              <span className={`theme-swatch ${theme}`} />
              {theme === 'oled' ? 'OLED Black' : theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
      </section>
      <section className="appearance-section">
        <h3>Accent color</h3>
        <div className="accent-controls">
          <label className="field">
            Color picker
            <input
              aria-label="Accent color picker"
              type="color"
              value={value.accent}
              onChange={(e) => update({ accent: e.target.value })}
            />
          </label>
          <label className="field hue-field">
            Hue
            <input
              aria-label="Accent hue"
              className="hue-slider"
              type="range"
              min="0"
              max="359"
              value={Math.round(hexHue(value.accent))}
              onChange={(e) => update({ accent: hueHex(Number(e.target.value)) })}
            />
          </label>
          <label className="field">
            Hex color
            <input
              aria-label="Accent hex color"
              value={hex}
              maxLength={7}
              spellCheck={false}
              aria-invalid={!/^#[\da-f]{6}$/i.test(hex)}
              onChange={(e) => {
                setHex(e.target.value);
                if (/^#[\da-f]{6}$/i.test(e.target.value)) update({ accent: e.target.value });
              }}
            />
          </label>
        </div>
        {!/^#[\da-f]{6}$/i.test(hex) && (
          <p className="inline-validation">Enter a six-digit hex color, such as #78f542.</p>
        )}
        <div className="appearance-preview" aria-label="Live accent preview">
          <span className="brand-mark">
            <span>SC</span>
          </span>
          <div>
            <strong>Live preview</strong>
            <p>Readable accents, on your terms.</p>
          </div>
          <button className="primary" type="button">
            Preview button
          </button>
        </div>
        <button className="quiet" onClick={() => update({ accent: DEFAULT_ACCENT })}>
          <RotateCcw size={15} /> Reset to default
        </button>
      </section>
      <section className="appearance-section">
        <h3>Background image</h3>
        <p className="muted">
          An image overrides the plain theme background. Cards and controls remain opaque.
        </p>
        <div
          className="background-preview"
          style={{
            backgroundColor:
              value.theme === 'light' ? '#f8f9fc' : value.theme === 'oled' ? '#000000' : '#151722',
          }}
          aria-label="Background preview"
        >
          {value.background && !missing ? (
            <>
              <img
                alt="Selected background"
                src={`supercard-media://local/${value.background}`}
                onError={() => setMissing(true)}
              />
              <span className="background-dimmer" style={{ opacity: value.dimming }} />
            </>
          ) : (
            <span>
              {missing ? 'Image unavailable. The plain theme is active.' : 'Theme background'}
            </span>
          )}
          <span className="background-example">Your cards stay readable</span>
        </div>
        <div className="background-actions">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const name = await window.supercard.chooseBackground();
                if (name) update({ background: name });
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <ImagePlus size={16} />
            {value.background ? 'Replace image' : 'Choose image'}
          </button>
          {value.background && (
            <button disabled={busy} onClick={() => update({ background: null })}>
              <Trash2 size={16} /> Remove image
            </button>
          )}
        </div>
        <label className="field dimming-control">
          Background dimming · {Math.round(value.dimming * 100)}%
          <input
            aria-label="Background dimming"
            type="range"
            min="0"
            max="95"
            value={Math.round(value.dimming * 100)}
            onChange={(e) => update({ dimming: Number(e.target.value) / 100 })}
          />
        </label>
      </section>
      <section className="appearance-section motion-setting">
        <div>
          <h3>Card motion</h3>
          <p className="muted">
            A gentle 300 ms flip. Your system’s reduced-motion preference takes priority.
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={value.animateFlips}
            onChange={(e) => update({ animateFlips: e.target.checked })}
          />{' '}
          Animate card flips
        </label>
      </section>
      <div className="modal-footer">
        <span className="muted">Preferences save automatically on this computer.</span>
        <button className="primary" disabled={busy} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
