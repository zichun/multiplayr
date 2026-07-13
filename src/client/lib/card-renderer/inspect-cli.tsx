/**
 * inspect-cli.tsx
 * Terminal inspector for card-renderer icons & cards. Run via `npm run inspect`.
 *
 *   npm run inspect icons                         # ASCII of every PRESET_ICON
 *   npm run inspect icons <module> [exportName]   # ASCII of a game's icon map(s)
 *   npm run inspect icon  <module> <iconId>       # ASCII of one icon
 *   npm run inspect card  <module> <exportName>   # lint an exported CardDefinition
 *   npm run inspect sheet <module> [exportName]   # write a faithful .svg icon sheet
 *
 * <module> is a path under src/ (with or without extension), e.g.
 *   rules/skull/SkullAssets   or   client/lib/card-renderer/presets
 *
 * ASCII + lint print to stdout (cheap, agent-readable). `sheet` writes a real SVG
 * (rendered by the actual ExpressiveIcon component, so it never drifts) to
 * build/inspect/ for pixel-accurate human/browser verification.
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';

import { Palette, IconObject } from './types';
import { PALETTES, PRESET_ICONS } from './presets';
import { ExpressiveIcon } from './IconEngine';
import { iconToAscii, lintCardDefinition, formatWarnings } from './inspect';

const SRC = path.resolve(__dirname, '..', '..', '..'); // .../src (from src/client/lib/card-renderer)
const OUT = path.resolve(SRC, '..', 'build', 'inspect');

function loadModule(rel: string): any {
    const clean = rel.replace(/\.(ts|tsx)$/, '');
    const candidates = [
        path.resolve(SRC, clean),
        path.resolve(process.cwd(), clean),
        path.resolve(process.cwd(), 'src', clean)
    ];
    for (const c of candidates) {
        for (const ext of ['', '.ts', '.tsx']) {
            if (fs.existsSync(c + ext)) return require(c + ext);
        }
    }
    throw new Error(`Cannot resolve module '${rel}' (looked under src/ and cwd).`);
}

function isIconObject(v: any): v is IconObject {
    return v && typeof v === 'object' && typeof v.id === 'string' && Array.isArray(v.layers);
}

/** Collect icons from a module: standalone IconObjects and Record<string,IconObject> maps. */
function collectIcons(mod: any, only?: string): Record<string, IconObject> {
    const found: Record<string, IconObject> = {};
    const keys = only ? [only] : Object.keys(mod);
    for (const k of keys) {
        const v = mod[k];
        if (isIconObject(v)) found[v.id || k] = v;
        else if (v && typeof v === 'object') {
            for (const kk of Object.keys(v)) if (isIconObject(v[kk])) found[v[kk].id || kk] = v[kk];
        }
    }
    return found;
}

/** Best-effort palette: an exported Palette, the first icon-map's sibling, or a preset. */
function pickPalette(mod: any, override?: string): Palette {
    if (override && PALETTES[override]) return PALETTES[override];
    for (const k of Object.keys(mod)) {
        const v = mod[k];
        if (v && typeof v === 'object' && typeof v.background === 'string' && typeof v.primary === 'string' && typeof v.border === 'string') {
            return v as Palette;
        }
        if (v && typeof v === 'object') {
            for (const kk of Object.keys(v)) {
                const p = v[kk];
                if (p && typeof p === 'object' && typeof p.background === 'string' && typeof p.primary === 'string') return p as Palette;
            }
        }
    }
    return PALETTES.midCentury;
}

function ensureOut() { fs.mkdirSync(OUT, { recursive: true }); }

function iconSvg(icon: IconObject, palette: Palette, savedIcons: Record<string, IconObject>): string {
    return renderToStaticMarkup(
        React.createElement(ExpressiveIcon, { icon, palette, savedIcons }) as any
    );
}

/** A responsive grid of every icon, rendered by the real component, into one .svg. */
function writeSheet(name: string, icons: Record<string, IconObject>, palette: Palette): string {
    ensureOut();
    const cell = 120, pad = 14, cols = Math.min(5, Object.keys(icons).length || 1);
    const entries = Object.entries(icons);
    const rows = Math.ceil(entries.length / cols);
    const W = cols * cell, H = rows * cell;
    const tiles = entries.map(([id, icon], i) => {
        const cx = (i % cols) * cell, cy = Math.floor(i / cols) * cell;
        const inner = iconSvg(icon, palette, icons)
            .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
        return `<g transform="translate(${cx + pad},${cy + pad})">` +
            `<svg x="0" y="0" width="${cell - pad * 2}" height="${cell - pad * 2 - 12}" viewBox="0 0 100 100">${inner}</svg>` +
            `<text x="${(cell - pad * 2) / 2}" y="${cell - pad * 2}" font-family="monospace" font-size="9" text-anchor="middle" fill="#555">${id}</text>` +
            `</g>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
        `<rect width="${W}" height="${H}" fill="#f4f4f2"/>${tiles}</svg>`;
    const file = path.resolve(OUT, `${name}.svg`);
    fs.writeFileSync(file, svg);
    return file;
}

function main() {
    const [cmd, modArg, arg2] = process.argv.slice(2);

    if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
        console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
        return;
    }

    if (cmd === 'icons' || cmd === 'icon' || cmd === 'sheet') {
        const isPresets = !modArg || modArg === 'presets';
        const mod = isPresets ? { PRESET_ICONS, PALETTES } : loadModule(modArg);
        const palette = pickPalette(mod, process.env.INSPECT_PALETTE);

        if (cmd === 'icon') {
            const all = collectIcons(mod);
            const icon = all[arg2];
            if (!icon) { console.error(`Icon '${arg2}' not found. Available: ${Object.keys(all).join(', ')}`); process.exit(1); }
            console.log(iconToAscii(icon, palette, { savedIcons: all }));
            return;
        }

        const icons = collectIcons(mod, cmd === 'icons' ? arg2 : undefined);
        const ids = Object.keys(icons);
        if (!ids.length) { console.error('No IconObjects found in module.'); process.exit(1); }

        if (cmd === 'sheet') {
            const name = (isPresets ? 'presets' : path.basename(modArg)).replace(/\W+/g, '_');
            const file = writeSheet(name, icons, palette);
            console.log(`Wrote ${ids.length} icons -> ${path.relative(process.cwd(), file)}`);
            console.log(`Open it, or view in the browser pane, for pixel-accurate check.`);
            return;
        }

        console.log(`# ${ids.length} icon(s), palette '${palette.name}'\n`);
        for (const id of ids) console.log(iconToAscii(icons[id], palette, { savedIcons: icons }) + '\n');
        return;
    }

    if (cmd === 'card') {
        const isPresets = modArg === 'presets';
        const mod = isPresets ? require('./presets') : loadModule(modArg);
        const target = isPresets ? mod.PRESET_CARDS : mod[arg2];
        const rest = process.argv.slice(5).map(a => { try { return JSON.parse(a); } catch { return a; } });

        // Resolve the export into a flat list of CardDefinitions:
        // an exported constant, an array of them, or a builder fn (called with the rest args).
        let defs: any[] = [];
        if (typeof target === 'function') defs = [target(...rest)];
        else if (Array.isArray(target)) defs = target;
        else if (target && target.widthMm) defs = [target];
        if (!defs.length || !defs[0]?.widthMm) {
            console.error(`Export '${isPresets ? 'PRESET_CARDS' : arg2}' is not a CardDefinition, array, or builder fn.`);
            process.exit(1);
        }

        const customIcons = collectIcons(mod);
        const widthPx = process.env.INSPECT_WIDTH ? parseInt(process.env.INSPECT_WIDTH, 10) : 80;
        for (const def of defs) {
            console.log(`# Lint '${def.name || def.id}' @ ${widthPx}px  (${def.widthMm}x${def.heightMm}mm)`);
            console.log(formatWarnings(lintCardDefinition(def, { widthPx, customIcons, palettes: PALETTES })));
        }
        return;
    }

    console.error(`Unknown command '${cmd}'. Run \`npm run inspect help\`.`);
    process.exit(1);
}

main();
