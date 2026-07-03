# Geometric Minimalist Playing Card Library

A standalone, highly customizable React and TypeScript rendering library designed to build and display physical-grade board game playing cards. The library enforces a strict flat vector, minimalist, and geometric aesthetic, utilizing structured modular layouts, responsive scaling mathematics, and a pure-vector icon compiler.

---

## Key Features

1. **Modular Snap-to-Grid Layout**
   Cards are structured around a modular vertical template consisting of five distinct, configurable regions:
   *   **Header / Status Bar**: Holds titles, subtitles, and small status/type icons.
   *   **Main Art Panel**: A dedicated region for large, complex vector art compositions, framed or borderless.
   *   **Dynamic Data Areas**: Flexible slots for rendering typical card attributes, supporting either traditional label-value rows or horizontally aligned, rounded icon pill grids (ideal for cost and resource lists).
   *   **Footer / Description**: Holds flavor or rule description text with independent alignment controls.
   *   **Composable Overlays**: Badge components that snap to the card's corners (e.g., top-left cost ribbon), with configurable position offsets, colors, and borders.

2. **Expressive SVG Icon Engine with Native Boolean Logic**
   Rather than loading heavy external raster assets or geometry-solver packages, the vector engine compiles complex shapes on-the-fly using native SVG elements and Boolean operations:
   *   **Primitives**: Circles, rectangles, triangles, arches, semi-circles, quarter-circles, zig-zag paths, custom Bezier splines, and repeating patterns (stripes, dots, grids).
   *   **Boolean Subtraction**: Cuts one shape out of another using SVG masking.
   *   **Boolean Intersection**: Restricts drawing to overlapping bounds using SVG clipping paths.
   *   **Boolean Union**: Groups shapes together under a shared transform canvas.
   *   **Layer Referencing**: Allows reusing saved icons within other icons' layer stacks, scaling and translating them dynamically.

3. **Millimeter Print Precision & Responsive CSS Scaling**
   The library supports two modes of execution:
   *   **Absolute Millimeter Mode**: Allows setting physical dimensions (e.g., standard Poker size: $63.5\text{ mm} \times 88.9\text{ mm}$, corner radius $3.5\text{ mm}$) for print layouts. Spacings and typography scale in perfect proportion to the card's physical width using dynamic font-size calculations.
   *   **Responsive Container Query Mode**: Leverages `container-type: inline-size` and `cqi` (container query inline width) units, allowing cards to scale inside fluid grid lists without breaking proportions, ideal for dense mobile viewports.

4. **Configurable Outer & Component Borders**
   *   Card outer borders are fully configurable (thickness in `em`, color key, or omitted).
   *   Overlay bookmark ribbons support visible border toggles and thickness sliders. The inner ribbon shapes are dynamically compiled and shifted proportionally under the hood to ensure uniform border width along the side edges and the bottom V-shaped notch.

5. **3D Card Flipping Animation & Back Face Support**
   Cards can be configured as two-sided by specifying a `backIconId` (which renders a centered vector icon on the back face). Toggling the `isFlipped` prop triggers a hardware-accelerated 3D flip animation. The back face automatically inherits the card's outer border width, border color, and corner radius, and supports a customizable background color (`backBgColor`).

---

## Getting Started

To render a card, import the `PlayingCard` component and pass it a `CardDefinition` object:

```tsx
import React from 'react';
import { PlayingCard } from './PlayingCard';
import { CardDefinition } from './types';

const myCard: CardDefinition = {
    id: 'commander_card',
    name: 'Desert Commander',
    widthMm: 63.5,
    heightMm: 88.9,
    borderRadiusMm: 3.5,
    palette: 'duneSpice',
    borderWidth: 0.25,      // Card outer border thickness (in em)
    borderColor: 'primary', // Color key pointing to active palette
    header: {
        title: 'DESERT LEADER',
        subtitle: 'COMMANDER MATRIX',
        stats: 'LVL VIII',
        background: 'panelBg'
    },
    mainArt: {
        iconId: 'sandworm',
        showFrame: true,
        frameStyle: 'thin'
    },
    data: {
        rows: [
            {
                label: 'SOLDIERS RECRUITED',
                value: '12'
            },
            {
                iconsList: [
                    { iconId: 'ruby', value: '3' },
                    { iconId: 'pearl', value: '1' }
                ],
                iconsListBg: 'panelBg',
                iconsListAlign: 'center'
            }
        ]
    },
    footer: {
        text: 'The desert makes no exceptions.',
        align: 'center',
        verticalAlign: 'center'
    },
    overlay: {
        position: 'top-left',
        iconId: 'costLeaf',
        value: '7',
        showBorder: true,
        borderWidth: 0.288
    }
};

export const CardPreview = () => (
    <PlayingCard
        card={myCard}
        scale={1.5}
        responsive={false}
        isFlipped={false} // Toggles 3D rotation to show the card back face
    />
);
```

---

## Configuration Schema (`types.ts`)

### `CardDefinition`
The root configuration interface defining the card's structural data, physical metrics, and layout.

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the card. |
| `name` | `string` | Human-readable name. |
| `widthMm` | `number` | Card width in millimeters (e.g., `63.5`). |
| `heightMm` | `number` | Card height in millimeters (e.g., `88.9`). |
| `borderRadiusMm` | `number` | Rounded corner radius in millimeters (e.g., `3.5`). |
| `palette` | `Palette \| string` | A palette configuration object or a string key pointing to a preset palette. |
| `borderWidth` | `number` | Optional. Thickness of the card outer border in `em` units. Set to `0` to disable. |
| `borderColor` | `string` | Optional. Color key pointing to a palette color for the outer border. |
| `backIconId` | `string` | Optional. Icon ID for the card's back face (e.g., 'waterDrop'). If omitted, the card is single-sided by default. |
| `backBgColor` | `string` | Optional. Color key or hex code for the back face background (defaults to `charcoal`). |
| `header` | `HeaderRegion` | Optional. Header / Status Bar configuration. |
| `mainArt` | `MainArtRegion` | Optional. Main illustration panel configuration. |
| `data` | `DataRegion` | Optional. Flexible rows and cost lists configuration. |
| `footer` | `FooterRegion` | Optional. Bottom description and alignment configuration. |
| `overlay` | `OverlayLeaf` | Optional. Corner overlay badge configuration. |

### `PlayingCard` Component Props
The React component accepts the following props to control rendering, dimensions, and interactive states:

| Prop | Type | Description |
| :--- | :--- | :--- |
| `card` | `CardDefinition` | The card schema definition containing content, regions, and assets. |
| `paletteOverride` | `Palette` | Optional. A palette object to override the card's defined palette. |
| `customIcons` | `Record<string, IconObject>` | Optional. Map of custom vector icons to merge with the library presets. |
| `showWireframe` | `boolean` | Optional. If `true`, renders dashed debug outlines around all card layout regions. |
| `scale` | `number` | Optional. General multiplier for absolute print mode dimensions (defaults to `1`). |
| `responsive` | `boolean` | Optional. If `true`, enables fluid container-query layout mode (`container-type: inline-size`). |
| `isFlipped` | `boolean` | Optional. Controls whether the card is flipped to show the back face (triggers a 3D rotate transition). |
| `width` | `string \| number` | Optional. Direct card width override (e.g. `80`, `"80px"`, `"100%"`). Ideal for consistent display sizes. |
| `height` | `string \| number` | Optional. Direct card height override. If omitted, scales automatically based on aspect ratio. |
| `hoverable` | `boolean` | Optional. If `true`, enables a smooth lifting hover animation and elevation shadow. |
| `selectable` | `boolean` | Optional. If `true`, shows a pointer cursor and enables hover lifting animations. |
| `selected` | `boolean` | Optional. If `true`, renders the card in a tactile pressed-down state with a prominent theme-colored outline. |
| `style` | `React.CSSProperties` | Optional. Custom styles to apply directly to the outer card container. |
| `onClick` | `() => void` | Optional. Click event handler. |

---

## Layout Regions Detail

### 1. Header Region (`HeaderRegion`)
Positioned at the top of the card. Automatically snaps title, subtitle, and meta information (e.g., level value and small icons) horizontally.

```typescript
export interface HeaderRegion {
    title?: string;
    subtitle?: string;
    stats?: string;
    background?: string; // Hex color or palette key (e.g. 'panelBg', 'none', 'transparent')
    icons?: Array<{
        iconId: string;
        value?: string;
        color?: string;
    }>;
}
```

### 2. Main Art Region (`MainArtRegion`)
Takes up the center of the card. Houses the primary vector illustration.

```typescript
export interface MainArtRegion {
    iconId?: string;       // ID of the vector icon to render
    showFrame?: boolean;   // Draw a geometric frame around the art
    frameStyle?: 'none' | 'thin' | 'thick' | 'double';
}
```

### 3. Data Region (`DataRegion` & `DataRow`)
Renders lists of stats or cost tokens below the illustration.

```typescript
export interface DataRegion {
    rows: DataRow[];
    background?: string; // Optional background color or palette key
}

export interface DataRow {
    // Traditional Label-Value Pair:
    label?: string;
    value?: string;
    iconId?: string;
    color?: string;

    // Horizontally aligned, rounded icon pill list (Splendor style):
    iconsList?: Array<{
        iconId: string;
        value?: string;
        color?: string;
    }>;
    iconsListBg?: string;          // Background color key for individual pills
    iconsListAlign?: 'left' | 'center' | 'right';
    iconsListIconSize?: number;    // Icon dimensions inside the pill (in em, default: 1.4)
    iconsListGap?: number;         // Gap between pills (in em, default: 0.8)
}
```

### 4. Footer Region (`FooterRegion`)
Sits at the bottom of the card. Enforces italicized, readable typography.

```typescript
export interface FooterRegion {
    text: string;
    align: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'center' | 'bottom';
    background?: string; // Optional background color or palette key
    size?: number;       // Optional grid size multiplier (default: 1)
}
```

### 5. Overlay Leaf (`OverlayLeaf`)
Snaps to any corner. Perfect for drawing resource costs, deck alignment symbols, or values.

```typescript
export interface OverlayLeaf {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    iconId?: string;           // Optional vector icon ID (e.g., 'costLeaf')
    value?: string;            // Overlay text value (e.g., '3')
    color?: string;            // Text color key
    showBorder?: boolean;      // Toggles the ribbon border
    borderColor?: string;      // Color of the outer border/ribbon
    backgroundColor?: string;  // Color of the inner fill/ribbon
    borderWidth?: number;      // Width of the outer border (in em, default: 0.288)
    offsetX?: number;          // Horizontal offset (in em, default: -0.7)
    offsetY?: number;          // Vertical offset (in em, default: 0.0)
}
```

---

## Vector Icon Engine (`IconEngine.tsx`)

Icons are compiled using a structured list of layer definitions (`IconLayer[]`). The coordinate system is based on a standard `100 x 100` SVG viewbox, with the center of individual primitive shapes positioned at `(x, y)` and local dimensions calculated relative to local coordinates.

### Primitive Shapes (`PrimitiveShape`)
Renders raw geometric elements:

*   **Circle (`circle`)**: A standard circle centered at `(0,0)` with radius `25`.
*   **Semi-Circle (`semi-circle`)**: A half-circle centered at `(0,0)` with radius `25`.
*   **Quarter-Circle (`quarter-circle`)**: A quarter-circle slice from `(0,0)` extending to radius `25`.
*   **Rectangle (`rectangle`)**: A centered square from `-25` to `25` (width `50`, height `50`).
*   **Triangle (`triangle`)**: An equilateral-ish triangle centered at `(0,0)` pointing up.
*   **Arch (`arch`)**: A rectangular base with a semi-circular top.
*   **Zig-Zag (`zig-zag`)**: A repeating zig-zag path line.
*   **Stripes / Dots / Grid (`stripes` \| `dots` \| `grid`)**: Repeating pattern fills clipped inside a square bounding box.
*   **Bezier Curve (`bezier`)**: Renders a complex path compiled from an array of anchor and control coordinates (`BezierPoint[]`) or a raw SVG path string (`customPath`).

```typescript
export interface PrimitiveShape {
    id: string;
    type: ShapeType;
    x: number;               // X center in canvas percent (0-100)
    y: number;               // Y center in canvas percent (0-100)
    scaleX?: number;         // X scaling multiplier (default: 1)
    scaleY?: number;         // Y scaling multiplier (default: 1)
    rotation?: number;       // Rotation in degrees (0-360)
    opacity?: number;        // Transparency (0 to 1)
    fill: string;            // Hex color or palette key ('primary', 'accent', etc.)
    stroke?: string;         // Stroke border color or palette key
    strokeWidth?: number;    // Stroke thickness in percentage units
    patternScale?: number;   // Pattern frequency scale
    bezierPoints?: BezierPoint[]; // For custom paths
    customPath?: string;     // Raw SVG path string
}
```

### Boolean Operations (`BooleanOperation`)
Combines two layers using SVG masks and clipping paths to construct complex vector art.

*   **Subtract (`subtract`)**: Masks out the `operandId` layer from the `baseId` layer.
*   **Intersect (`intersect`)**: Clips the `baseId` layer path to the bounds of the `operandId` layer.
*   **Union (`union`)**: Combines both layers under a single canvas group.

```typescript
export interface BooleanOperation {
    id: string;
    type: 'boolean';
    op: 'union' | 'intersect' | 'subtract';
    baseId: string;      // ID of the target layer
    operandId: string;   // ID of the layer acting as the clipping mask
}
```

### Icon References (`IconRef`)
Embeds a saved reusable icon inside another icon's layer stack.

```typescript
export interface IconRef {
    id: string;
    type: 'ref';
    iconId: string;      // ID of the saved icon to embed
    x: number;           // X offset
    y: number;           // Y offset
    scale: number;       // Sizing scale
    rotation?: number;
    opacity?: number;
    colorOverride?: string; // Forces all child layers to a specific color
}
```

---

## Color Palettes (`presets.ts`)

A palette must provide a consistent set of color keys to ensure visual contrast and flexibility across card themes:

```typescript
export interface Palette {
    id: string;
    name: string;
    background: string; // Base background color of the card
    border: string;     // Default card border color
    primary: string;    // Main accent color
    secondary: string;  // Supporting accent color (often muted gold/yellow)
    accent: string;     // Contrasting highlight color
    charcoal: string;   // Neutral dark color (used for body text/dark panels)
    text: string;       // Default body text color
    panelBg?: string;   // Background color for internal panels/containers
    tertiary: string;   // Third accent color for versatile game tokens
    success: string;    // Color indicating positive modifiers/success states
    danger: string;     // Color indicating negative modifiers/danger states
}
```

### Preset Palettes
1.  **Mid-Century Modern (`midCentury`)**: Warm cream, earthy orange, deep cyan, muted gold, and charcoal.
2.  **Soft Pastel (`softPastel`)**: Crisp white, soft peach, mint green, muted lavender, and slate.
3.  **Dune Spice (`duneSpice`)**: Basalt black, sand gold, spice red, sky cyan, and desert olive green.
4.  **Neon Synthwave (`neonSynth`)**: Dark space blue, hot pink, electric cyan, acid lime, and ultraviolet.

---

## Reusable Glyphs & the Token Builder (`presets.ts`)

To stop every game from re-drawing the same shapes, `PRESET_ICONS` ships flat, single-colour, palette-keyed glyphs. Because their fills are palette keys (`secondary`, `charcoal`, `background`, `danger`), they re-theme automatically for any card palette, and you can recolour them per-use with the icon's `color` (header/data) or `colorOverride`.

| Icon id | Shape | Typical use |
| :--- | :--- | :--- |
| `star` | Five-point star (gold `secondary`) | Prestige / rating / score |
| `crown` | Three-point crown (gold `secondary`) | Crowns / royalty milestones |
| `lock` | Padlock (`charcoal`) | Reserved / hidden / locked |
| `scroll` | Rolled scroll (parchment + `danger` ribbon) | Privilege / decree |

### The `coinIcon` builder — flat token / cost pips

The single most reused card pattern is a **solid colour disc with a glyph knocked out of it** (negative space). A solid disc reads clearly at any size, and the glyph — drawn in the card `background` colour (or white) — looks like a punched hole. Use the same disc icon for board tokens, card-cost pips, and player-panel counts so the whole game stays visually identical.

```typescript
import { coinIcon } from './presets';

// A sapphire token: blue disc, three white circles knocked out.
const sapphire = coinIcon('gem_blue', '#2f93c2', [
    { id: 's1', type: 'circle', x: 50, y: 36, scaleX: 0.42, scaleY: 0.42, fill: '#ffffff' },
    { id: 's2', type: 'circle', x: 36, y: 62, scaleX: 0.42, scaleY: 0.42, fill: '#ffffff' },
    { id: 's3', type: 'circle', x: 64, y: 62, scaleX: 0.42, scaleY: 0.42, fill: '#ffffff' }
]);

// Pass game-specific icons via the customIcons prop; they merge over the presets.
<PlayingCard card={def} customIcons={{ gem_blue: sapphire }} />
```

`coinIcon(id, discColor, glyph, name?)` prepends a disc (`circle`, `scale 1.9` ≈ fills the 100×100 box) under your glyph layers. Fill the glyph with `'#ffffff'` / `'background'` for a coloured coin on a light card, or with `'primary'` (the band colour) for a *white* disc whose glyph shows the band through it (a header bonus badge).

---

## Sizing Robustness & Layout Notes

* **Vector icons cannot inflate a card.** An `ExpressiveIcon` `<svg>` has no intrinsic pixel size; as a growable flex child it used to force the art region to its ~150px fallback and blow the card up. The core `.card-art-region` now sets `min-height: 0; min-width: 0;` and clamps the icon to `max-width/height: 100%`, so the default (stacked header → art → footer) layout stays correct at any size **without per-game CSS**.
* **Bespoke layouts** (a coloured header band, a cost column pinned left, art pinned right — e.g. tableau / engine-builder cards) are still done by scoping overrides under a wrapper class and **absolutely positioning** the regions inside `.playing-card-face.face-front` (`display: block; position: relative`). Pin `header`/`footer` to fixed `em` heights and let `art` fill the gap with `overflow: hidden`. This is the pattern in `SplendorDuel` (`.jewel-card` / `.royal-card`).
* **Text is `em`-based and compounds.** `1em ≈ widthMm × 0.052` scaled by the pixel `width`; region sizes nest (e.g. the footer text is an `em` of the footer region's own `0.9 × footer.size em`). At small widths, boost `footer.size`, keep labels short, and allow wrapping rather than shipping sub-5px text.
* **Pixel mode** (`width="Npx"`) disables the compact container-query that hides regions under 150px, and derives height from `heightMm/widthMm` (the `height` prop is ignored) — set card *shape* via mm and *size* via `width`.

---

## Interactive Designer Sandbox

An interactive visual designer is available to test, draft, and compile playing cards and vector icons:

1.  **Launch the development server**:
    ```powershell
    node build/app.js
    ```
2.  **Open the Workspace**:
    Navigate to **`http://localhost:3000/cards`** in your browser.
3.  **Features**:
    *   **Preset Loader**: Quickly switch between standard presets (Bene Gesserit, Dune, Shai-Hulud, Splendor Gem, Space Ranger).
    *   **Real-Time Layout Sliders**: Scale card dimensions (20mm - 140mm), adjust corners, configure outer borders, and toggle grid wireframes.
    *   **Overlay Configurator**: Toggle ribbon borders, slide border thickness, shift offsets, and swap text colors.
    *   **Vector Icon Designer**: Add, remove, and reorder shape layers, configure Boolean operations, draw bezier splines, and instantly compile and inject them into the active card.
    *   **Schema Exporter**: Automatically generates the valid React JSON schema representing the card configuration, ready to copy and paste directly into your game code.
