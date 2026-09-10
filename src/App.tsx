import { useEffect, useRef, useState } from 'react';
import { version } from '../package.json';
import {
  Layers,
  Plus,
  Search,
  Moon,
  Sun,
  ArrowLeft,
  ArrowRight,
  Play,
  Pencil,
  Trash2,
  X,
  Check,
  RotateCcw,
  Shuffle,
  Upload,
  Download,
  Archive,
  FolderOpen,
  Info,
} from 'lucide-react';
import type { Card, Collection, ImportPreview, TransferReport } from '../shared/types';
import Content from './Content';
import CardEditor from './CardEditor';
import ImportDialog from './ImportDialog';
import Modal from './Modal';
import AppearanceDialog from './AppearanceDialog';
import StudyCard from './StudyCard';
import LearnMode from './LearnMode';
import FocusButton from './FocusButton';
import { studyShortcut } from './study-shortcuts';
import { useAppearance } from './useAppearance';

const api = window.supercard;
export default function App() {
  const [data, setData] = useState<Collection>({ decks: [], cards: [] });
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const preferences = useAppearance();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [showAppearance, setShowAppearance] = useState(false);
  const [backgroundMissing, setBackgroundMissing] = useState(false);
  useEffect(() => setBackgroundMissing(false), [preferences.appearance.background]);
  const [editor, setEditor] = useState<Partial<Card> | null>(null);
  const [deckDialog, setDeckDialog] = useState<{ id?: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; kind: 'deck' | 'card' } | null>(null);
  const [learn, setLearn] = useState<Card[] | null>(null);
  const [study, setStudy] = useState<Card[] | null>(null);
  const [focusView, setFocusView] = useState(false);
  useEffect(() => {
    if (!study && !learn) setFocusView(false);
  }, [study, learn]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (
        focusView &&
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        !document.querySelector('[role="dialog"],[role="menu"],[role="listbox"]')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setFocusView(false);
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [focusView]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<TransferReport | null>(null);
  const [restore, setRestore] = useState<{
    token: string;
    decks: number;
    cards: number;
    images: number;
  } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(50);
  const closeGuard = useRef<(() => Promise<void>) | null>(null);
  useEffect(
    () =>
      api.onCloseRequested(() => {
        void (async () => {
          try {
            await closeGuard.current?.();
            await preferencesRef.current.flush();
            await api.finishClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        })();
      }),
    [],
  );
  const refresh = async () => {
    const result = await api.load();
    setData(result);
    setSelected((old) =>
      result.decks.some((d) => d.id === old) ? old : (result.decks[0]?.id ?? ''),
    );
  };
  useEffect(() => {
    refresh()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  const deck = data.decks.find((d) => d.id === selected);
  const cards = data.cards.filter((c) => c.deckId === selected);
  const filtered = cards.filter((c) =>
    `${c.front} ${c.back} ${c.tags}`.toLowerCase().includes(query.toLowerCase()),
  );
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
  const chooseImport = () =>
    run(async () => {
      const preview = await api.chooseCSV();
      if (preview) setImporting(preview);
    });
  useEffect(() => setPageLimit(50), [selected, query]);
  const move = (delta: number) => {
    if (!study) return;
    setIndex((i) => Math.max(0, Math.min(study.length - 1, i + delta)));
    setFlipped(false);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!study) return;
      const action = studyShortcut(e, !!document.querySelector('[role="dialog"]'));
      if (!action) return;
      e.preventDefault();
      if (action === 'flip') setFlipped((f) => !f);
      else if (action === 'next') move(1);
      else if (action === 'previous') move(-1);
      else setStudy(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [study]);
  return (
    <div
      className={`app-shell ${focusView && (study || learn) ? 'focus-view' : ''} ${preferences.appearance.background && !backgroundMissing ? 'has-background' : ''}`}
    >
      {preferences.appearance.background && !backgroundMissing && (
        <div className="app-wallpaper" aria-hidden="true">
          <img
            src={`supercard-media://local/${preferences.appearance.background}`}
            alt=""
            onError={() => setBackgroundMissing(true)}
          />
          <div style={{ opacity: preferences.appearance.dimming }} />
        </div>
      )}
      {showAppearance && (
        <AppearanceDialog
          value={preferences.appearance}
          update={preferences.update}
          saveError={preferences.error}
          onClose={() => setShowAppearance(false)}
        />
      )}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Layers size={22} />
          </span>
          SuperCard<span className="brand-dot">.</span>
        </div>
        <div className="library-label">
          YOUR LIBRARY <span>{data.decks.length}</span>
        </div>
        <button className="new-deck" onClick={() => setDeckDialog({ name: '' })}>
          <Plus size={17} /> New deck
        </button>
        <nav aria-label="Decks">
          {data.decks.map((d) => (
            <button
              key={d.id}
              className={`deck-nav ${selected === d.id ? 'active' : ''}`}
              onClick={() => {
                setSelected(d.id);
                setQuery('');
                setStudy(null);
                setLearn(null);
              }}
            >
              <Layers size={18} />
              <span>{d.name}</span>
              <small>{data.cards.filter((c) => c.deckId === d.id).length}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="library-tools">
            <button className="quiet" disabled={busy} onClick={chooseImport}>
              <Upload size={16} /> Import CSV / TSV
            </button>
            <button
              className="quiet"
              disabled={busy || !data.decks.length}
              onClick={() => run(async () => setReport(await api.exportBackup()))}
            >
              <Archive size={16} /> Back up library
            </button>
            <button
              className="quiet"
              disabled={busy}
              onClick={() => run(async () => setRestore(await api.previewBackup()))}
            >
              <FolderOpen size={16} /> Restore backup
            </button>
          </div>
          <button
            className="quiet"
            disabled={!preferences.loaded}
            onClick={() => setShowAppearance(true)}
          >
            <Sun size={17} /> Appearance
          </button>
          <button className="quiet" onClick={() => run(async () => setInfo(await api.dataPath()))}>
            <Info size={16} /> About & storage
          </button>
        </div>
      </aside>
      <main>
        {busy && (
          <div role="status" className="transfer-status">
            Processing files…{' '}
            <button onClick={() => api.cancelTransfer()}>Cancel preparation</button>
          </div>
        )}
        {(error || preferences.error || backgroundMissing) && (
          <div className="error" role="alert">
            {error ||
              preferences.error ||
              'Background image unavailable. The theme background has been restored.'}
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {!ready ? (
          <div className="empty">
            <Layers size={38} />
            <h2>{error ? 'Couldn’t open your library' : 'Opening your library…'}</h2>
            {error && (
              <button
                onClick={() =>
                  run(async () => {
                    await refresh();
                    setReady(true);
                  })
                }
              >
                Try again
              </button>
            )}
          </div>
        ) : learn ? (
          <LearnMode
            focusView={focusView}
            onToggleFocus={() => setFocusView((v) => !v)}
            cards={learn}
            name={deck?.name || 'Learn'}
            animate={preferences.appearance.animateFlips}
            onExit={() => setLearn(null)}
          />
        ) : study ? (
          <section className="study-view">
            <div className="study-heading">
              <button className="quiet" onClick={() => setStudy(null)}>
                <ArrowLeft size={17} /> Back to deck
              </button>
              <span>{deck?.name}</span>
              <span className="pill">FLASHCARDS</span>
              <FocusButton active={focusView} onToggle={() => setFocusView((v) => !v)} />
            </div>
            <div className="study-progress">
              <span>
                Card {index + 1} of {study.length}
              </span>
              <span>{Math.round(((index + 1) / study.length) * 100)}%</span>
            </div>
            <div className="progress-track">
              <div style={{ width: `${((index + 1) / study.length) * 100}%` }} />
            </div>
            <StudyCard
              key={study[index].id}
              card={study[index]}
              flipped={flipped}
              animate={preferences.appearance.animateFlips}
              onFlip={() => setFlipped((f) => !f)}
            />
            <div className="study-controls">
              <button
                className="quiet"
                onClick={() => {
                  const shuffled = [...study];
                  for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                  }
                  setStudy(shuffled);
                  setIndex(0);
                  setFlipped(false);
                }}
              >
                <Shuffle size={17} /> Shuffle
              </button>
              <div className="arrows">
                <button aria-label="Previous card" disabled={index === 0} onClick={() => move(-1)}>
                  <ArrowLeft size={20} />
                </button>
                <span>
                  {index + 1} / {study.length}
                </span>
                <button
                  aria-label="Next card"
                  disabled={index === study.length - 1}
                  onClick={() => move(1)}
                >
                  <ArrowRight size={20} />
                </button>
              </div>
              <button
                className="quiet"
                onClick={() => {
                  setIndex(0);
                  setFlipped(false);
                }}
              >
                <RotateCcw size={17} /> Restart
              </button>
            </div>
          </section>
        ) : !deck ? (
          <div className="welcome empty">
            <div className="welcome-art">
              <Layers size={54} />
            </div>
            <span className="eyebrow">A LITTLE PRACTICE. A LOT OF POSSIBILITY.</span>
            <h1>Make room for what you’ll learn.</h1>
            <p>
              Your ideas, equations, and discoveries. One card at a time.
              <br />
              Create your first deck and start anywhere.
            </p>
            <button className="primary" onClick={() => setDeckDialog({ name: '' })}>
              <Plus size={18} /> Create your first deck
            </button>
            <button className="quiet" disabled={busy} onClick={chooseImport}>
              <Upload size={16} /> Or import your flashcards
            </button>
          </div>
        ) : (
          <section className="deck-view">
            <div className="deck-heading">
              <div>
                <h1>{deck.name}</h1>
                <p>
                  {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="quiet export-button"
                  disabled={busy || !cards.length}
                  onClick={() => run(async () => setReport(await api.exportDeck(deck.id)))}
                >
                  <Download size={16} /> Export
                </button>
                <button
                  className="icon-button"
                  aria-label="Rename deck"
                  onClick={() => setDeckDialog({ id: deck.id, name: deck.name })}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete deck"
                  onClick={() => setDeleting({ id: deck.id, kind: 'deck' })}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            <div className="study-banner">
              <button
                className="primary"
                disabled={!cards.length}
                onClick={() => {
                  setStudy(cards);
                  setIndex(0);
                  setFlipped(false);
                }}
              >
                <Play size={17} fill="currentColor" /> Study deck
              </button>
              <span className="eyebrow action-or">OR</span>
              <button
                className="primary"
                disabled={!cards.length}
                onClick={() => {
                  setStudy(null);
                  setLearn([...cards]);
                }}
              >
                <Check size={17} /> Learn deck
              </button>
            </div>
            <div className="card-toolbar">
              <h2>
                Cards <span>{cards.length}</span>
              </h2>
              <div className="toolbar-actions">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Search cards or tags"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button aria-label="Clear search" onClick={() => setQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </label>
                <button
                  className="primary"
                  onClick={() => setEditor({ deckId: deck.id, front: '', back: '', tags: '' })}
                >
                  <Plus size={17} /> Add card
                </button>
              </div>
            </div>
            {!filtered.length ? (
              <div className="empty card-empty">
                <h2>{query ? 'No matching cards' : 'No cards yet'}</h2>
                {query && <p>Try another word, equation, or tag.</p>}
                {!query && (
                  <button
                    onClick={() => setEditor({ deckId: deck.id, front: '', back: '', tags: '' })}
                  >
                    <Plus size={16} /> Add your first card
                  </button>
                )}
              </div>
            ) : (
              <div className="card-list">
                <div className="list-labels">
                  <span>#</span>
                  <span>FRONT</span>
                  <span>BACK</span>
                  <span />
                </div>
                {filtered.slice(0, pageLimit).map((c, i) => (
                  <article className="card-row" key={c.id}>
                    <span className="card-number">{i + 1}</span>
                    <div className="card-face">
                      <Content source={c.front.slice(0, 4000)} />
                      {c.tags && (
                        <div className="tags">
                          {c.tags
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((t, index) => (
                              <span key={index}>{t.replace(/_/g, ' ')}</span>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="card-face">
                      <Content source={c.back.slice(0, 4000)} />
                    </div>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Study card ${i + 1}`}
                        onClick={() => {
                          setStudy(cards);
                          setIndex(cards.findIndex((card) => card.id === c.id));
                          setFlipped(false);
                        }}
                      >
                        <Play size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Edit card ${i + 1}`}
                        onClick={() => setEditor({ ...c })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete card ${i + 1}`}
                        onClick={() => setDeleting({ id: c.id, kind: 'card' })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {filtered.length > pageLimit && (
              <div className="load-more">
                <button onClick={() => setPageLimit((n) => n + 50)}>
                  Show more cards ({filtered.length - pageLimit} remaining)
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      {deckDialog && (
        <Modal
          label={deckDialog.id ? 'Rename deck' : 'Create deck'}
          small
          onClose={() => {
            if (!busy) setDeckDialog(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (deckDialog.id) await api.renameDeck(deckDialog.id, deckDialog.name);
                else {
                  const d = await api.createDeck(deckDialog.name);
                  setSelected(d.id);
                }
                await refresh();
                setDeckDialog(null);
              });
            }}
          >
            <div className="modal-heading">
              <h2>{deckDialog.id ? 'Rename deck' : 'Create deck'}</h2>
              <button type="button" aria-label="Close" onClick={() => setDeckDialog(null)}>
                <X size={20} />
              </button>
            </div>
            <label className="field deck-name-field">
              Deck name
              <input
                autoFocus
                maxLength={100}
                placeholder="e.g. Calculus essentials"
                value={deckDialog.name}
                onChange={(e) => setDeckDialog({ ...deckDialog, name: e.target.value })}
              />
            </label>
            <div className="modal-footer">
              <button type="button" onClick={() => setDeckDialog(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy || !deckDialog.name.trim()}>
                {deckDialog.id ? 'Save name' : 'Create deck'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editor && (
        <CardEditor
          card={editor}
          deckName={deck?.name || ''}
          onSaved={refresh}
          closeGuard={closeGuard}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <Modal
          label="Confirm deletion"
          small
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="delete-icon">
            <Trash2 size={24} />
          </div>
          <h2>Delete this {deleting.kind}?</h2>
          <p>
            {deleting.kind === 'deck'
              ? 'This deck and all its cards will be removed.'
              : 'This card will be removed from your deck.'}{' '}
            This cannot be undone.
          </p>
          <div className="modal-footer">
            <button onClick={() => setDeleting(null)}>Keep {deleting.kind}</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (deleting.kind === 'deck') await api.deleteDeck(deleting.id);
                  else await api.deleteCard(deleting.id);
                  await refresh();
                  setDeleting(null);
                })
              }
            >
              Delete {deleting.kind}
            </button>
          </div>
        </Modal>
      )}
      {importing && (
        <ImportDialog
          initial={importing}
          decks={data.decks}
          onClose={() => setImporting(null)}
          onImported={async (result) => {
            await refresh();
            if (result.deckId) setSelected(result.deckId);
            setImporting(null);
            setReport(result);
          }}
        />
      )}
      {report && (
        <Modal label="Transfer complete" small onClose={() => setReport(null)}>
          <div className="modal-heading">
            <h2>All set.</h2>
            <button aria-label="Close report" onClick={() => setReport(null)}>
              <X size={20} />
            </button>
          </div>
          <p>{report.message}</p>
          {!!report.warnings.length && (
            <div className="warning-list report-warnings">
              <strong>{report.warnings.length} notes to review</strong>
              <ul>
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="modal-footer">
            <button className="primary" onClick={() => setReport(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {restore && (
        <Modal
          label="Restore backup"
          small
          onClose={() => {
            if (!busy) setRestore(null);
          }}
        >
          <h2>Bring your library back.</h2>
          <p>
            This backup contains {restore.decks} decks, {restore.cards} cards, and {restore.images}{' '}
            images. Restored decks will be added alongside your existing decks.
          </p>
          <div className="modal-footer">
            <button disabled={busy} onClick={() => setRestore(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await api.restoreBackup(restore.token);
                  await refresh();
                  if (result.deckId) setSelected(result.deckId);
                  setRestore(null);
                  setReport(result);
                })
              }
            >
              Restore library
            </button>
          </div>
        </Modal>
      )}
      {info && (
        <Modal label="About SuperCard" small onClose={() => setInfo(null)}>
          <div className="modal-heading">
            <h2>
              SuperCard <span className="muted">{version}</span>
            </h2>
            <button aria-label="Close about" onClick={() => setInfo(null)}>
              <X size={20} />
            </button>
          </div>
          <p>
            A little practice, on your terms. Every card is available whenever you want to study.
          </p>
          <h3>Quick guide</h3>
          <p>
            Flashcards uses Left/Right for previous/next. Learn uses Left for Still learning and
            Right for Know it. At each round's end, review only the remaining cards. Learn progress
            stays in the session and never changes your deck.
          </p>
          <p>
            Click a card or press Space, Up, or Down to flip it. Left/Right behavior depends on your
            study mode. Page Up/Down scroll long cards. Escape returns to the deck.
          </p>
          <p>
            Open Appearance in the sidebar for themes, accent colors, backgrounds, and Animate card
            flips. Reduced motion always suppresses rotation. Study shortcuts pause while editing or
            using a dialog.
          </p>
          <p>Vibecoded by ChatGPT 6 Astra - Idea from Seth</p>
          <strong>Saved on this computer</strong>
          <p className="storage-path">{info}</p>
          <p>
            SQLite stores your decks and cards. The media folder stores copied images. Back up your
            library to move both together.
          </p>
          <p className="muted">
            Basic front/back cards, safe HTML, TeX math, and PNG, JPEG, GIF, or WebP images. Cloze
            templates, audio, video, and Anki packages are not supported.
          </p>
          <div className="modal-footer">
            <button className="primary" onClick={() => setInfo(null)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
