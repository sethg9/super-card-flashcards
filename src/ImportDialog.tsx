import { useMemo, useState } from 'react';
import { ArrowRight, FolderOpen, Upload, X } from 'lucide-react';
import type { Deck, ImportPreview, TransferReport } from '../shared/types';
import { defaultMapping, mapImport } from '../shared/csv';
import { imageReferences } from '../shared/images';
import Content from './Content';
import Modal from './Modal';

export default function ImportDialog({
  initial,
  decks,
  onClose,
  onImported,
}: {
  initial: ImportPreview;
  decks: Deck[];
  onClose: () => void;
  onImported: (report: TransferReport) => Promise<void>;
}) {
  const [preview, setPreview] = useState(initial);
  const [mapping, setMapping] = useState(defaultMapping(initial.parsed));
  const [destination, setDestination] = useState('');
  const [name, setName] = useState(
    (initial.parsed.headers.deck || initial.name.replace(/_/g, ' ')).slice(0, 100),
  );
  const [folder, setFolder] = useState<{ token: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => {
    try {
      return mapImport(preview.parsed, mapping);
    } catch {
      return null;
    }
  }, [preview, mapping]);
  const imageCount = new Set(
    result?.cards.flatMap((c) => [...imageReferences(c.front), ...imageReferences(c.back)]) || [],
  ).size;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      label="Import flashcards"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">BRING YOUR KNOWLEDGE WITH YOU</span>
          <h2>Import flashcards</h2>
          <p className="file-description">
            {preview.name} · {preview.parsed.rows.length - (mapping.hasHeader ? 1 : 0)} rows
          </p>
        </div>
        <button aria-label="Close import" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <div className="import-controls">
        <label className="field">
          Separator
          <select
            value={preview.parsed.delimiter}
            disabled={busy}
            onChange={(e) =>
              run(async () => {
                const p = await window.supercard.reparseCSV(preview.token, e.target.value);
                setPreview(p);
                setMapping(defaultMapping(p.parsed));
              })
            }
          >
            {[
              [',', 'Comma (CSV)'],
              ['\t', 'Tab (TSV)'],
              [';', 'Semicolon'],
              ['|', 'Pipe'],
              [':', 'Colon'],
              [' ', 'Space'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {(['front', 'back', 'tags'] as const).map((side) => (
          <label className="field" key={side}>
            {side === 'front' ? 'Front column' : side === 'back' ? 'Back column' : 'Tags column'}
            <select
              value={mapping[side]}
              onChange={(e) => setMapping({ ...mapping, [side]: Number(e.target.value) })}
            >
              {side === 'tags' && <option value={-1}>None</option>}
              {preview.parsed.columns.map((c, i) => (
                <option key={i} value={i}>
                  {i + 1}. {c}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="import-options">
        <label>
          <input
            type="checkbox"
            checked={mapping.hasHeader}
            onChange={(e) => setMapping({ ...mapping, hasHeader: e.target.checked })}
          />{' '}
          First row contains column names
        </label>
        <label>
          <input
            type="checkbox"
            checked={mapping.html}
            onChange={(e) => setMapping({ ...mapping, html: e.target.checked })}
          />{' '}
          Render safe HTML formatting
        </label>
      </div>
      {!result && (
        <div className="inline-error">Choose different columns for the front and back.</div>
      )}
      <div className="import-destination">
        <label className="field">
          Import into
          <select value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">A new deck</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {!destination && (
          <label className="field">
            New deck name
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
      </div>
      <div className="media-import">
        <div>
          <strong>
            {imageCount ? `${imageCount} referenced images` : 'Have accompanying images?'}
          </strong>
          <p>
            {folder
              ? `Selected: ${folder.name}`
              : 'Select the flat media folder that came with your cards.'}
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const chosen = await window.supercard.chooseMediaFolder();
              if (chosen) setFolder(chosen);
            })
          }
        >
          <FolderOpen size={16} />
          {folder ? 'Change folder' : 'Choose media folder'}
        </button>
      </div>
      {imageCount > 0 && !folder && (
        <p className="import-note">
          Images without a matching managed file will be reported as missing. You can still import
          the text.
        </p>
      )}
      {!!result?.warnings.length && (
        <div className="warning-list">
          <strong>Import notes</strong>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="preview-heading">
        <span className="preview-label">
          PREVIEW · FIRST {Math.min(result?.cards.length || 0, 3)} CARDS
        </span>
        <span>{preview.totalRows - (mapping.hasHeader ? 1 : 0)} rows in file</span>
      </div>
      <p className="import-note">
        Preview uses the first 10 records and abbreviates long fields. All rows are validated during
        import.
      </p>
      <div className="import-preview">
        {result?.cards.slice(0, 3).map((card, i) => (
          <div className="import-preview-row" key={i}>
            <Content source={card.front} />
            <ArrowRight size={15} />
            <Content source={card.back} />
          </div>
        ))}
      </div>
      <div className="modal-footer">
        <span className="muted">Cards are added as new. Existing cards are kept.</span>
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy || !result?.cards.length || (!destination && !name.trim())}
          onClick={() =>
            run(async () => {
              const report = await window.supercard.importCSV({
                token: preview.token,
                mapping,
                deckId: destination || undefined,
                deckName: name,
                mediaToken: folder?.token,
              });
              await onImported(report);
            })
          }
        >
          <Upload size={16} />
          {busy ? 'Importing…' : 'Import cards'}
        </button>
      </div>
    </Modal>
  );
}
