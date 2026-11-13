/**
 * DecorumData.ts — game constants for Décorum (round track, hearts, reactions,
 * house-meeting moods) plus re-exports of the scenario library.
 */

export * from './scenario';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/**
 * The round track as segments. A Heart-to-Heart / House Meeting follows every
 * segment but the last, and each meeting flips one heart.
 *   2 players: 15 rounds, then 5 + 5 + 5   (3 hearts, 30 rounds)
 *   3–4:       5 + 5 + 5 + 5 + 5 + 5       (5 hearts, 30 rounds)
 */
export const SEGMENTS: Record<number, number[]> = {
    2: [15, 5, 5, 5],
    3: [5, 5, 5, 5, 5, 5],
    4: [5, 5, 5, 5, 5, 5]
};

export const segmentsFor = (players: number): number[] => SEGMENTS[players] || SEGMENTS[4];
export const heartsFor = (players: number): number => segmentsFor(players).length - 1;
export const totalRoundsFor = (players: number): number => segmentsFor(players).reduce((s, n) => s + n, 0);

export const POINTS_PER_CONDITION = 3;
export const POINTS_PER_HEART = 2;

export type Reaction = 'love' | 'meh' | 'hate';
export const REACTIONS: Reaction[] = ['love', 'meh', 'hate'];
export const REACTION_LABEL: Record<Reaction, string> = { love: 'Positive', meh: 'Neutral', hate: 'Negative' };

/** Things people say (picked deterministically per reaction). */
export const REACTION_LINES: Record<Reaction, string[]> = {
    love: ['I love it!', 'That makes me happy.', 'Oh, yes!', 'Perfect.', 'I was hoping for that!'],
    meh: ['Meh.', "I don't really care.", "That's fine.", 'Sure, whatever.', "I'm neutral on that."],
    hate: ['I hate it!', "That's the worst.", 'But that was my favorite…', 'Oh no.', 'Please, no.']
};

export function reactionLine(kind: Reaction, salt: number): string {
    const lines = REACTION_LINES[kind];
    return lines[Math.abs(salt) % lines.length];
}

/** House-meeting moods (3–4 players). `blame` / `praise` name a housemate. */
export type Mood = 'happy' | 'close' | 'far' | 'lost' | 'blame' | 'praise';
export const MOODS: Mood[] = ['happy', 'close', 'far', 'lost', 'blame', 'praise'];
export const MOOD_LINE: Record<Mood, string> = {
    happy: "I'm pretty happy with the house",
    close: "I feel like we're getting close",
    far: 'We have a long way to go',
    lost: "I have no idea what anyone wants",
    blame: 'is ruining everything',
    praise: 'is a dream housemate'
};
export const moodNeedsTarget = (m: Mood) => m === 'blame' || m === 'praise';

/** The spoken line, e.g. "Sam is ruining everything" / "You are a dream housemate". */
export function moodText(m: Mood, target?: string | null): string {
    if (!moodNeedsTarget(m)) return MOOD_LINE[m];
    const who = target || 'Someone';
    return who === 'You' ? `You ${MOOD_LINE[m].replace(/^is /, 'are ')}` : `${who} ${MOOD_LINE[m]}`;
}
