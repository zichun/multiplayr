/**
 * CKBits.tsx — small shared visual primitives for Critter Kitchen: icons,
 * tokens, chef heads, cards, the star counter and a modal.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';
import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { CardDefinition } from '../../../client/lib/card-renderer/types';
import {
    CK_ICONS, CK_PALETTE, accentPalette, chefIconId, portraitId, criticCard, restCard, zousCard, rumorCard,
    challengeCard, backCard, ING_COLORS
} from '../CKAssets';
import {
    Item, SOUP_PICK, ChefKind, ZOUS_BY_ID, CRITIC_BY_ID, REST_BY_ID, RUMOR_BY_ID, CHALLENGE_BY_ID, itemLabel,
    IngType, RumorKind, ING_TYPES
} from '../CKData';
import { isZousKey } from '../CKGameState';

export const Icon: React.FC<{ id: string; size?: number; className?: string; title?: string; accent?: string }> =
    ({ id, size = 20, className, title, accent }) => (
        <span className={['ck-icon', className || ''].join(' ')} style={{ width: size, height: size }} title={title}>
            {CK_ICONS[id] && <ExpressiveIcon icon={CK_ICONS[id]} palette={accent ? accentPalette(accent) : CK_PALETTE} savedIcons={CK_ICONS} />}
        </span>
    );

export function itemIconId(it: Item | { k: string; t?: string; r?: string; z?: string }): string {
    switch (it.k) {
        case 'ing': return `ing_${it.t}`;
        case 'spice': return `spice_${it.t}`;
        case 'rumor': return `rumor_${it.r}`;
        case 'soup': return 'soup';
        case 'bisque': return 'bisque';
        case 'zous': return `art_${ZOUS_BY_ID[it.z as string]?.animal || 'fox'}`;
    }
    return 'bag';
}

export const SOUP_ITEM: Item = { id: SOUP_PICK, k: 'soup' };

/** A token: coin/diamond/bubble with an optional value badge. */
export const Tok: React.FC<{
    item: Item;
    size?: number;
    onClick?: () => void;
    selected?: boolean;
    dim?: boolean;
    marked?: boolean;
    spice?: Item | null;
    count?: number;
    title?: string;
    pop?: boolean;
}> = ({ item, size = 34, onClick, selected, dim, marked, spice, count, title, pop = true }) => {
    const badge = item.k === 'ing' ? String(item.v)
        : item.k === 'soup' ? (item.id === SOUP_PICK ? '∞' : '1')
            : item.k === 'bisque' ? '3'
                : item.k === 'zous' ? String(ZOUS_BY_ID[item.z as string]?.cap || '') : '';
    const cls = [
        'ck-tok', `k-${item.k}`, onClick ? 'is-tap' : '', selected ? 'is-sel' : '', dim ? 'is-dim' : '',
        marked ? 'is-marked' : '', pop ? 'pop' : ''
    ].join(' ');
    return (
        <span className={cls} style={{ width: size, height: size }} onClick={onClick}
            title={title || itemLabel(item)} role={onClick ? 'button' : undefined}>
            <Icon id={itemIconId(item)} size={size} />
            {item.k === 'zous' && <span className="ck-tok-hat"><Icon id="hat" size={Math.round(size * 0.42)} /></span>}
            {badge && <span className="ck-tok-badge" style={{ fontSize: Math.max(9, Math.round(size * 0.34)) }}>{badge}</span>}
            {spice && <span className="ck-tok-spice"><Icon id={itemIconId(spice)} size={Math.round(size * 0.5)} /></span>}
            {count && count > 1 ? <span className="ck-tok-count">×{count}</span> : null}
        </span>
    );
};

export const ChefHead: React.FC<{ chefKey: string; accent: string; size?: number; title?: string; ghost?: boolean; active?: boolean }> =
    ({ chefKey, accent, size = 28, title, ghost, active }) => {
        if (isZousKey(chefKey)) {
            const z = ZOUS_BY_ID[chefKey.slice(2)];
            return (
                <span className={['ck-chef', 'zous', ghost ? 'ghost' : '', active ? 'active' : ''].join(' ')}
                    style={{ width: size, height: size, ['--acc' as any]: accent }} title={title || z?.name}>
                    <Icon id={portraitId(z?.animal || 'fox')} size={size} />
                    <span className="ck-chef-cap">{z?.cap}</span>
                </span>
            );
        }
        const cap = chefKey === 'mouse' ? 1 : chefKey === 'lizard' ? 2 : 3;
        return (
            <span className={['ck-chef', ghost ? 'ghost' : '', active ? 'active' : ''].join(' ')}
                style={{ width: size, height: size, ['--acc' as any]: accent }} title={title || chefKey}>
                <Icon id={chefIconId(chefKey as ChefKind)} size={size} accent={accent} />
                <span className="ck-chef-cap">{cap}</span>
            </span>
        );
    };

/** Star counter that bumps when the value changes. */
export class StarCount extends React.Component<{ n: number; size?: number }, { bump: number }> {
    state = { bump: 0 };
    componentDidUpdate(prev: { n: number }) {
        if (prev.n !== this.props.n) this.setState(s => ({ bump: s.bump + 1 }));
    }
    render() {
        return (
            <span className="ck-starcount" key={this.state.bump}>
                <Icon id="star" size={this.props.size || 18} />
                <b className={this.state.bump ? 'bump' : ''}>{this.props.n}</b>
            </span>
        );
    }
}

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------

export type CardRef =
    | { kind: 'critic'; id: string }
    | { kind: 'rest'; id: string }
    | { kind: 'zous'; id: string }
    | { kind: 'rumor'; id: string }
    | { kind: 'challenge'; id: string; held?: boolean }
    | { kind: 'back'; of: 'rumor' | 'challenge'; slot?: RumorKind };

export function cardDef(c: CardRef): CardDefinition {
    switch (c.kind) {
        case 'critic': return criticCard(CRITIC_BY_ID[c.id]);
        case 'rest': return restCard(REST_BY_ID[c.id]);
        case 'zous': return zousCard(ZOUS_BY_ID[c.id]);
        case 'rumor': return rumorCard(RUMOR_BY_ID[c.id]);
        case 'challenge': return challengeCard(CHALLENGE_BY_ID[c.id], !!c.held);
        case 'back': return backCard(c.of, c.slot);
    }
}

export function cardText(c: CardRef): { title: string; kind: string; text: string } | null {
    switch (c.kind) {
        case 'critic': { const d = CRITIC_BY_ID[c.id]; return { title: d.name, kind: 'Critic', text: d.text }; }
        case 'rest': { const d = REST_BY_ID[c.id]; return { title: d.name, kind: `Restaurateur · ${d.stars}★ at game end`, text: d.text }; }
        case 'zous': { const d = ZOUS_BY_ID[c.id]; return { title: d.name, kind: `Zous-chef · carries ${d.cap}`, text: d.text }; }
        case 'rumor': { const d = RUMOR_BY_ID[c.id]; return { title: d.name, kind: d.advanced ? 'Advanced rumor' : 'Rumor', text: d.text }; }
        case 'challenge': {
            const d = CHALLENGE_BY_ID[c.id];
            return { title: d.name, kind: 'Challenge', text: `Serve at least one each of ${(c.held ? d.req.slice(0, 2) : d.req).join(', ')}${c.held ? ' (the hold token covers the last requirement)' : ''}. Soup may stand in for a missing ingredient.` };
        }
        default: return null;
    }
}

export const CKCard: React.FC<{
    card: CardRef;
    width?: number;
    onClick?: () => void;
    selected?: boolean;
    className?: string;
}> = ({ card, width = 92, onClick, selected, className }) => (
    <div className={['ck-card', `ck-card-${card.kind}`, className || ''].join(' ')} style={{ width }}>
        <PlayingCard card={cardDef(card)} width={`${width}px`} customIcons={CK_ICONS}
            hoverable={!!onClick} selectable={!!onClick} selected={selected} onClick={onClick} />
    </div>
);

// ---------------------------------------------------------------------------
// modal
// ---------------------------------------------------------------------------

/** Rendered into document.body so `position: fixed` is never trapped by a transformed ancestor. */
export const Modal: React.FC<{ onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }> =
    ({ onClose, title, children, wide }) => {
        // Mobile browsers occasionally never start the entrance animation on a fresh node; with a
        // `both` fill the modal would stay on its invisible first keyframe. Drop it once it should be over.
        const [settled, setSettled] = React.useState(false);
        React.useEffect(() => { const t = setTimeout(() => setSettled(true), 450); return () => clearTimeout(t); }, []);
        const node = (
            <div className={['ck-modal-back', settled ? 'settled' : ''].join(' ')} onClick={onClose}>
                <div className={['ck-modal', wide ? 'wide' : ''].join(' ')} onClick={e => e.stopPropagation()}>
                    {title && <div className="ck-modal-title">{title}</div>}
                    <button className="ck-modal-x" onClick={onClose} aria-label="Close">×</button>
                    {children}
                </div>
            </div>
        );
        return typeof document !== 'undefined' && document.body ? createPortal(node, document.body) : node;
    };

export const CardDetail: React.FC<{ card: CardRef; onClose: () => void }> = ({ card, onClose }) => {
    const t = cardText(card);
    return (
        <Modal onClose={onClose}>
            <div className="ck-detail">
                <CKCard card={card} width={200} />
                {t && (
                    <div className="ck-detail-text">
                        <div className="ck-detail-kind">{t.kind}</div>
                        <div className="ck-detail-title">{t.title}</div>
                        <p>{t.text}</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// item helpers
// ---------------------------------------------------------------------------

const KIND_ORDER: Record<string, number> = { ing: 0, spice: 1, bisque: 2, soup: 3, rumor: 4, zous: 5 };

export function sortItems(items: Item[]): Item[] {
    return items.slice().sort((a, b) => {
        const k = KIND_ORDER[a.k] - KIND_ORDER[b.k];
        if (k) return k;
        if (a.k === 'ing' || a.k === 'spice') {
            const ta = a.t === 'all' ? 99 : ING_TYPES.indexOf(a.t as IngType);
            const tb = b.t === 'all' ? 99 : ING_TYPES.indexOf(b.t as IngType);
            if (ta !== tb) return ta - tb;
            return (b.v || 0) - (a.v || 0);
        }
        return a.id - b.id;
    });
}

export const IngDot: React.FC<{ t: IngType; size?: number }> = ({ t, size = 10 }) => (
    <span className="ck-ingdot" style={{ width: size, height: size, background: ING_COLORS[t] }} />
);
