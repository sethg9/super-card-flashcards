import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLearn, classifyLearn, reviewRemaining } from '../shared/learn';
import type { Card } from '../shared/types';
const cards = [1, 2, 3].map((n) => ({
  id: String(n),
  deckId: 'd',
  front: `Q${n}`,
  back: `A${n}`,
  tags: '',
  createdAt: '',
  updatedAt: '',
})) as Card[];
test('Learn repeats only remaining cards, then completes without changing the deck', () => {
  const original = JSON.stringify(cards);
  let state = startLearn(cards);
  state = classifyLearn(state, true);
  state = classifyLearn(state, false);
  state = classifyLearn(state, true);
  assert.equal(state.known, 2);
  assert.equal(state.remaining.length, 1);
  assert.equal(classifyLearn(state, false), state);
  state = reviewRemaining(state);
  assert.equal(state.round, 2);
  assert.deepEqual(
    state.cards.map((c) => c.id),
    ['2'],
  );
  state = classifyLearn(state, true);
  assert.equal(state.index, state.cards.length);
  assert.equal(state.remaining.length, 0);
  assert.equal(reviewRemaining(state), state);
  assert.equal(JSON.stringify(cards), original);
});
test('Learn handles empty, single-card, premature review and all-still-learning rounds', () => {
  const empty = startLearn([]);
  assert.equal(classifyLearn(empty, false), empty);
  let state = startLearn(cards.slice(0, 1));
  assert.equal(reviewRemaining(state), state);
  for (let i = 0; i < 3; i++) {
    state = reviewRemaining(classifyLearn(state, false));
    assert.equal(state.cards.length, 1);
    assert.equal(state.index, 0);
  }
  assert.equal(state.round, 4);
  state = startLearn(cards);
  for (let i = 0; i < cards.length; i++) state = classifyLearn(state, false);
  assert.deepEqual(reviewRemaining(state).cards, cards);
});
