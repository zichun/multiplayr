# dice-roller

A small, standalone, reusable React library for **rendering dice with custom faces** and
playing **roll animations**. It is independent of any game and mirrors the conventions of
`card-renderer` (which it reuses for vector glyphs).

- **Custom faces** — each face is a vector `IconObject` (the same DSL used by
  `card-renderer`) and/or a text label, with per-face colours.
- **Configurable rendering** — size, corner radius, border, glyph scale, and a **`flat`**
  (2D) or **`iso`** (readable 2.5D, extruded) style, all via a `theme` object.
- **Roll animation** — dice tumble through random faces so the **result is hidden until
  the animation finishes**. Duration, stagger, and flip speed are configurable.
- **Two animation modes** — `in-place` (tumble in the die's own slot) or `overlay` (dice
  tumble on a full-viewport portal, independent of the container, then fly into their
  slots).
- **Dice pool** — `DicePool` lays out and animates many dice at once, staggered.

## Install / import

No build step — import the components directly (like `card-renderer`):

```tsx
import { Die, DicePool, DiceFaceset, DiceTheme } from '../../client/lib/dice-roller';
```

The library's SCSS is imported automatically by `Die`.

## Faces

```ts
import { DiceFaceset } from '../../client/lib/dice-roller';
import { MY_ICONS } from './MyAssets'; // card-renderer IconObject map

const faces: DiceFaceset = {
    fire:  { id: 'fire',  icon: MY_ICONS.flame, color: '#e0703a', glyphColor: '#fff' },
    water: { id: 'water', icon: MY_ICONS.drop,  color: '#2b90b3', glyphColor: '#fff' },
    six:   { id: 'six',   label: '6',           color: '#2b333c', glyphColor: '#fff' }, // text face
};
```

## A single die

```tsx
<Die
    faceId="fire"
    faceset={faces}
    theme={{ style: 'iso', size: 56 }}
    animation={{ duration: 700 }}
    rollNonce={rollCount}   // bump to force a re-roll animation (even to the same face)
    onClick={() => lock()}
    title="Fire"
>
    <span className="my-badge">×2</span>   {/* optional overlay layer */}
</Die>
```

The tumble replays on mount and whenever `rollNonce` **or** `faceId` changes. Pass a
`rollNonce` when you need a re-roll to animate even though the face landed the same.

### `DieProps`
| prop | meaning |
|------|---------|
| `faceId` | the resulting face id |
| `faceset` | the `DiceFaceset` (also the pool of faces flashed while tumbling) |
| `theme?` | `DiceTheme` (see below) |
| `animation?` | `RollAnimation` (see below) |
| `rollNonce?` | change → replay the roll animation |
| `delay?` | ms before this die starts (used by `DicePool` for stagger) |
| `className/style/onClick/title/children` | passthrough; `children` render as an overlay |
| `onRollStart/onRollEnd` | lifecycle callbacks |

## A pool

`DicePool` animates a whole pool and leaves interaction to you via `renderDie`, which hands
back the computed `DieProps` to spread onto `<Die/>`:

```tsx
<DicePool
    dice={[{ id: 'd1', faceId: 'fire' }, { id: 'd2', faceId: 'water' }]}
    faceset={faces}
    theme={{ style: 'flat', size: 46 }}
    animation={{ mode: 'in-place', duration: 700, stagger: 55 }}
    rollNonce={rollCount}
    renderDie={(datum, dieProps) => (
        <Die {...dieProps} className={selected(datum) ? 'is-sel' : ''} onClick={() => pick(datum)} />
    )}
/>
```

Change detection: bumping `rollNonce` re-rolls the whole pool (staggered by `stagger`).
Adding a die or changing a die's `faceId` animates just that die.

## Theme

```ts
interface DiceTheme {
    style?: 'flat' | 'iso'; // default 'flat'
    size?: number;          // px, default 46
    radius?: number;        // corner radius px; default ≈ size * 0.24
    borderColor?: string;
    borderWidth?: number;   // px, default 0
    depth?: number;         // iso extrusion depth px; default ≈ size * 0.16
    glyphScale?: number;    // glyph size as a fraction of the die; default 0.62
}
```

## Animation

```ts
interface RollAnimation {
    enabled?: boolean;       // default true; false = show results immediately (no motion)
    mode?: 'in-place' | 'overlay';  // default 'in-place'
    duration?: number;       // ms of the tumble, default 700
    stagger?: number;        // ms between dice in a pool, default 55
    tumbleInterval?: number; // ms between random face flips, default 70
}
```

- **`in-place`** — each die tumbles in its slot; the result appears when it settles.
- **`overlay`** — on a roll the dice tumble on a full-viewport portal (independent of the
  container), reveal, then fly into their measured slots. Interaction resumes once landed.
- Respects `prefers-reduced-motion` (the CSS spin is suppressed); set `enabled: false` to
  skip animation entirely.

## Notes

- Depends only on `card-renderer` (`ExpressiveIcon`, `IconObject`, `Palette`).
- Faces flashed while tumbling are drawn at random from `faceset`, so the result stays
  hidden until settle — the animation always plays *before* the result is shown.
