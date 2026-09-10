import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { Card } from '../shared/types';
import { classifyLearn, reviewRemaining, startLearn } from '../shared/learn';
import { studyShortcut } from './study-shortcuts';
import StudyCard from './StudyCard';
import FocusButton from './FocusButton';
export default function LearnMode({
  focusView,
  onToggleFocus,
  cards,
  name,
  animate,
  onExit,
}: {
  focusView: boolean;
  onToggleFocus: () => void;
  cards: Card[];
  name: string;
  animate: boolean;
  onExit: () => void;
}) {
  const [session, setSession] = useState(() => startLearn(cards));
  const [flipped, setFlipped] = useState(false);
  const [verdict, setVerdict] = useState<'left' | 'right' | null>(null);
  const [feedback, setFeedback] = useState('');
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stage = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLHeadingElement>(null);
  const done = session.index >= session.cards.length;
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (done) summary.current?.focus();
    else stage.current?.focus({ preventScroll: true });
  }, [session.index, session.round, done]);
  const classify = (known: boolean) => {
    if (locked.current || done || document.querySelector('[role="dialog"]')) return;
    locked.current = true;
    setVerdict(known ? 'right' : 'left');
    setFeedback(known ? 'Know it!' : 'Still learning');
    // Keep the same short input guard with reduced motion; feedback itself is immediate.
    timer.current = setTimeout(() => {
      setSession((old) => classifyLearn(old, known));
      setFlipped(false);
      setVerdict(null);
      locked.current = false;
    }, 320);
  };
  const flip = () => {
    if (!locked.current) setFlipped((f) => !f);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const action = studyShortcut(event, !!document.querySelector('[role="dialog"]'), true);
      if (!action) return;
      if (action === 'exit') {
        event.preventDefault();
        onExit();
        return;
      }
      if (done) return;
      event.preventDefault();
      if (action === 'flip') flip();
      if (action === 'previous') classify(false);
      if (action === 'next') classify(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const fullAgain = () => {
    setSession(startLearn(cards));
    setFlipped(false);
    setFeedback('New full-deck session');
  };
  return (
    <section className="study-view learn-view">
      <div className="study-heading">
        <button className="quiet" onClick={onExit}>
          <ArrowLeft size={17} /> Exit Learn
        </button>
        <span>{name}</span>
        <span className="pill">LEARN</span>
        <FocusButton active={focusView} onToggle={onToggleFocus} />
      </div>
      {!cards.length ? (
        <div className="learn-summary">
          <h2 ref={summary} tabIndex={-1}>
            No cards to learn yet
          </h2>
          <p>Add a card to this deck to begin.</p>
          <button onClick={onExit}>Return to library</button>
        </div>
      ) : done ? (
        <div className="learn-summary">
          <h2 ref={summary} tabIndex={-1}>
            {session.remaining.length ? `Round ${session.round} complete` : 'You know every card!'}
          </h2>
          <p>
            {session.known} marked Know it this round · {session.remaining.length} still learning
          </p>
          {session.remaining.length > 0 ? (
            <button
              className="primary"
              onClick={() => {
                setSession(reviewRemaining);
                setFlipped(false);
                setFeedback('Reviewing remaining cards');
              }}
            >
              Review remaining cards
            </button>
          ) : (
            <button className="primary" onClick={fullAgain}>
              Study full deck again
            </button>
          )}
          <button onClick={onExit}>Return to library</button>
        </div>
      ) : (
        <>
          <div className="study-progress">
            <span>
              Round {session.round} · Card {session.index + 1} of {session.cards.length}
            </span>
            <span>
              {session.cards.length - session.index} to classify · {session.remaining.length} still
              learning
            </span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${(session.index / session.cards.length) * 100}%` }} />
          </div>
          <div
            tabIndex={-1}
            ref={stage}
            className={`learn-stage ${verdict ? `to-${verdict}` : ''}`}
            aria-busy={!!verdict}
          >
            <StudyCard
              key={`${session.round}-${session.index}`}
              card={session.cards[session.index]}
              flipped={flipped}
              animate={animate}
              onFlip={flip}
            />
          </div>
          <div
            className="learn-actions"
            onKeyDown={(e) => {
              if (e.repeat) e.preventDefault();
            }}
          >
            <button
              aria-label="Still learning, Left arrow"
              disabled={!!verdict}
              onClick={(e) => {
                if (e.detail <= 1) classify(false);
              }}
            >
              <X size={20} />
              <span>Still learning</span>
              <kbd>←</kbd>
            </button>
            <button
              className="primary"
              aria-label="Know it, Right arrow"
              disabled={!!verdict}
              onClick={(e) => {
                if (e.detail <= 1) classify(true);
              }}
            >
              <Check size={20} />
              <span>Know it</span>
              <kbd>→</kbd>
            </button>
          </div>
        </>
      )}
      {!done && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`learn-feedback ${verdict ? 'visible' : ''}`}
        >
          {feedback || 'Flip with click, Space, Up or Down. Classify before or after flipping.'}
        </div>
      )}
    </section>
  );
}
