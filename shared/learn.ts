import type { Card } from './types';
export interface LearnRound {
  round: number;
  cards: Card[];
  index: number;
  remaining: Card[];
  known: number;
}
export function startLearn(cards: Card[]): LearnRound {
  return { round: 1, cards: [...cards], index: 0, remaining: [], known: 0 };
}
export function classifyLearn(state: LearnRound, known: boolean): LearnRound {
  if (state.index >= state.cards.length) return state;
  return {
    ...state,
    index: state.index + 1,
    known: state.known + (known ? 1 : 0),
    remaining: known ? state.remaining : [...state.remaining, state.cards[state.index]],
  };
}
export function reviewRemaining(state: LearnRound): LearnRound {
  if (state.index < state.cards.length || !state.remaining.length) return state;
  return { round: state.round + 1, cards: state.remaining, index: 0, remaining: [], known: 0 };
}
