import { useEffect, useRef, useState, type RefObject } from 'react';
import { Check, ImagePlus, X, LoaderCircle } from 'lucide-react';
import type { Card, CardInput } from '../shared/types';
import Content from './Content';
import Modal from './Modal';
import { IMAGE_LIMIT } from '../shared/images';

export default function CardEditor({
  card,
  deckName,
  onSaved,
  onClose,
  closeGuard,
}: {
  card: Partial<Card>;
  deckName: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  closeGuard: RefObject<(() => Promise<void>) | null>;
}) {
  const draftKey = `draft:${card.deckId}:${card.id || 'new'}`;
  const [value, setValue] = useState<CardInput>(() => {
    let draft: Partial<CardInput> = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(draftKey) || '{}');
      if (parsed && typeof parsed === 'object') draft = parsed;
    } catch {
      /* Ignore an invalid draft. */
    }
    return {
      id: card.id,
      deckId: card.deckId!,
      front: typeof draft.front === 'string' ? draft.front : card.front || '',
      back: typeof draft.back === 'string' ? draft.back : card.back || '',
      tags: typeof draft.tags === 'string' ? draft.tags : card.tags || '',
    };
  });
  const [status, setStatus] = useState('Draft saved on this computer');
  const [error, setError] = useState('');
  const [imagesBusy, setImagesBusy] = useState(false);
  const latest = useRef(value);
  latest.current = value;
  const id = useRef(card.id);
  const lastSaved = useRef(
    card.id ? JSON.stringify({ front: card.front, back: card.back, tags: card.tags }) : '',
  );
  const pending = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const areas = useRef<Partial<Record<'front' | 'back', HTMLTextAreaElement | null>>>({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const save = () => {
    const snapshot = { ...latest.current };
    const serial = JSON.stringify({
      front: snapshot.front,
      back: snapshot.back,
      tags: snapshot.tags,
    });
    const job = pending.current
      .catch(() => {})
      .then(async () => {
        if (!snapshot.front.trim() || !snapshot.back.trim()) return;
        if (serial === lastSaved.current) {
          if (alive.current) setStatus('All changes saved');
          localStorage.removeItem(draftKey);
          return;
        }
        if (alive.current) {
          setStatus('Saving…');
          setError('');
        }
        try {
          const saved = await window.supercard.saveCard({ ...snapshot, id: id.current });
          id.current = saved.id;
          lastSaved.current = serial;
          // Remove the draft only if a newer edit has not arrived during the save.
          if (
            JSON.stringify({
              front: latest.current.front,
              back: latest.current.back,
              tags: latest.current.tags,
            }) === serial
          )
            localStorage.removeItem(draftKey);
          if (alive.current) setStatus('All changes saved');
          await onSaved();
        } catch (e) {
          if (alive.current) {
            setStatus('Not saved — draft kept locally');
            setError(e instanceof Error ? e.message : String(e));
          }
          throw e;
        }
      });
    pending.current = job;
    return job;
  };
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(value));
    } catch {
      setError('Draft storage is full. Save this card before closing.');
    }
    clearTimeout(timer.current);
    if (value.front.trim() && value.back.trim()) {
      setStatus('Saving…');
      timer.current = setTimeout(() => {
        void save().catch(() => {});
      }, 650);
    } else setStatus('Draft saved · add both sides to create a card');
    return () => clearTimeout(timer.current);
  }, [value]);
  const close = async () => {
    if (imagesBusy) return;
    clearTimeout(timer.current);
    try {
      await save();
      onClose();
    } catch {
      /* Keep editor open so the user can retry. */
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    closeGuard.current = async () => {
      if (imagesBusy)
        throw new Error(
          'An image is still being copied. Please close the window once it finishes.',
        );
      clearTimeout(timer.current);
      await saveRef.current();
    };
    return () => {
      closeGuard.current = null;
    };
  }, [closeGuard, imagesBusy]);
  const insert = (side: 'front' | 'back', names: string[]) => {
    if (!names.length) return;
    const area = areas.current[side];
    const start = area?.selectionStart ?? latest.current[side].length,
      end = area?.selectionEnd ?? start;
    const markup = names.map((name) => `<img src="${name}" alt="Card image">`).join('\n');
    setValue((old) => ({
      ...old,
      [side]: old[side].slice(0, start) + markup + old[side].slice(end),
    }));
    area?.focus();
  };
  const upload = async (side: 'front' | 'back', files?: File[]) => {
    setImagesBusy(true);
    setError('');
    try {
      let names: string[];
      if (files) {
        if (files.length > 20) throw new Error('Insert at most 20 images at a time.');
        names = [];
        for (const file of files) {
          if (file.size > IMAGE_LIMIT)
            throw new Error(`${file.name} exceeds 200 MB (209,715,200 bytes).`);
          names.push(await window.supercard.addImage(new Uint8Array(await file.arrayBuffer())));
        }
      } else names = await window.supercard.pickImages();
      insert(side, names);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImagesBusy(false);
    }
  };
  return (
    <Modal
      label={card.id ? 'Edit card' : 'New card'}
      onClose={() => {
        void close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void close();
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{deckName}</span>
            <h2>{card.id ? 'Edit your card' : 'One idea. Two sides.'}</h2>
          </div>
          <button
            type="button"
            aria-label="Close editor"
            disabled={imagesBusy}
            onClick={() => {
              void close();
            }}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="editor-help">
          Write naturally, add simple HTML formatting, or use <code>{'\\( inline math \\)'}</code>{' '}
          and <code>{'\\[ display math \\]'}</code>.
        </div>
        <div className="editor-grid">
          {(['front', 'back'] as const).map((side) => (
            <div
              className="editor-side"
              key={side}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!imagesBusy && e.dataTransfer.files.length)
                  void upload(side, [...e.dataTransfer.files]);
              }}
            >
              <label className="field">
                {side === 'front' ? 'Front · Question' : 'Back · Answer'}
                <textarea
                  ref={(element) => {
                    areas.current[side] = element;
                  }}
                  autoFocus={side === 'front'}
                  maxLength={200_000}
                  placeholder={
                    side === 'front' ? 'What do you want to remember?' : 'Make it click.'
                  }
                  value={value[side]}
                  onChange={(e) => setValue({ ...value, [side]: e.target.value })}
                  onPaste={(e) => {
                    const files = [...e.clipboardData.items]
                      .filter((i) => i.type.startsWith('image/'))
                      .map((i) => i.getAsFile())
                      .filter((f): f is File => !!f);
                    if (files.length) {
                      e.preventDefault();
                      if (!imagesBusy) void upload(side, files);
                    }
                  }}
                />
              </label>
              <div className="image-toolbar">
                <button
                  type="button"
                  className="quiet"
                  disabled={imagesBusy}
                  onClick={() => {
                    void upload(side);
                  }}
                >
                  <ImagePlus size={15} /> Add image
                </button>
                <span>or drop / paste an image</span>
              </div>
              <span className="preview-label">LIVE PREVIEW</span>
              <div className="preview">
                <Content source={value[side] || 'Your preview appears here…'} />
              </div>
            </div>
          ))}
        </div>
        <label className="field">
          Tags <span className="muted">optional, separated by spaces</span>
          <input
            value={value.tags}
            maxLength={10_000}
            onChange={(e) => setValue({ ...value, tags: e.target.value })}
            placeholder="e.g. calculus chapter_1"
          />
        </label>
        <div className="modal-footer">
          <span className="save-status" role="status">
            {status === 'Saving…' || imagesBusy ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Check size={14} />
            )}{' '}
            {imagesBusy ? 'Copying images…' : status}
          </span>
          <button
            type="button"
            disabled={imagesBusy}
            onClick={() => {
              void close();
            }}
          >
            Close
          </button>
          <button
            className="primary"
            disabled={imagesBusy || !value.front.trim() || !value.back.trim()}
          >
            <Check size={17} /> Save card
          </button>
        </div>
      </form>
    </Modal>
  );
}
