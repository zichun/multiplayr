/**
 * Décorum scenario library — house model, condition language and a seeded,
 * contradiction-free scenario generator for 2, 3 and 4 players.
 *
 *   import { generateScenario } from './scenario';
 *   const s = generateScenario({ players: 3, level: 'hard', seed: 1234 });
 *   s.cards[0]            // seat 0's conditions
 *   describeText(s.cards[0][0])
 *   evaluate(s.cards[0][0], house)
 *
 * No React / Multiplayr dependencies: safe for the engine, views and tests.
 */
export * from './model';
export * from './conditions';
export * from './twists';
export * from './generator';
export * as rng from './rng';
