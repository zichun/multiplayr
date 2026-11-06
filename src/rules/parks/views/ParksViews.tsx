/**
 * ParksViews.tsx — React views for Parks.
 *
 * Presentation only: every mutation goes through an MP RPC method. Component
 * state holds nothing but unconfirmed taps (a highlighted Hiker, a draft
 * payment). Built for a phone in portrait: the Trail, your tokens and the market
 * fit one screen, each engine decision opens one bottom sheet, and tableaus and
 * rules move to their own gameshell tabs.
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ViewPropsInterface } from '../../../common/interfaces';
import { icons as LOBBY_ICONS } from '../../lobby/LobbyView';

import { PlayingCard } from '../../../client/lib/card-renderer/PlayingCard';
import { ExpressiveIcon } from '../../../client/lib/card-renderer/IconEngine';

import {
    Token, TOKENS, TOKEN_NAME, Bag, SYMS, PARK_BY_ID, GEAR_BY_ID, CANTEEN_BY_ID, CANTEEN_TEXT, SEASON_BY_ID,
    YEAR_BY_ID, SITES, SiteId, EVENT_BY_ID, EVENT_OP_TEXT, MIN_PLAYERS, MAX_PLAYERS, TOKEN_LIMIT, gearText, soloRating,
    yearDescription, yearNextStep, NfAction, CAMPSITE_BY_ID, campsideFor, nfActionText, CAMPSITE_BOARD_ACTION,
    NfModules, NF_MODULES, nfModulesOf, nfAny, nfFull, WlModules, WL_MODULES, wlModulesOf, wlAny, wlFull
} from '../ParksData';
import {
    PARKS_ICONS, PARKS_UI_PALETTE, tokenIconId, siteIconId, getParkCardDefinition, getGearCardDefinition, getSiteCardDefinition, getTrailEndCardDefinition,
    getCanteenCardDefinition, getYearCardDefinition, seasonEffectLine, bagList, yearTrackIcon, SEASON_THEMES, SeasonTheme, GEAR_RATIO, nfActionLine
} from '../ParksAssets';
import {
    Phase, END, Area, AREAS, coversPayment, VisitOption, BuyOption, MoveOptions, ScoreBreakdown, LogItem, LogEntry, LogResult, CampOption, CampSpot
} from '../ParksGameState';
import { ParksRulesView } from './ParksRulesView';

interface ParksProps extends ViewPropsInterface {
    game: any;
    playerNames: Record<string, string>;
    playerAccents: Record<string, string>;
    playerIcons: Record<string, number>;
    isHost: boolean;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

export const Icon: React.FC<{ id: string; size?: number; title?: string }> = ({ id, size = 18, title }) => (
    <span className="pk-icon" style={{ width: size, height: size }} title={title}>
        <ExpressiveIcon icon={PARKS_ICONS[id]} palette={PARKS_UI_PALETTE} savedIcons={PARKS_ICONS} />
    </span>
);

/** A player's piece: their lobby icon in their lobby colour. The Rangers have no lobby seat, so they keep their own figure. */
const Pawn: React.FC<{ accent: string; icon?: number; size?: number; ranger?: boolean; moving?: boolean }> = ({ accent, icon, size = 18, ranger, moving }) => (
    ranger
        ? <span className="pk-ranger"><Icon id="ranger" size={size} /></span>
        : (
            <span className={['pk-pawn', moving ? 'moving' : ''].join(' ')} style={{ width: size, height: size, color: accent }}>
                <FontAwesomeIcon icon={LOBBY_ICONS[icon ?? 0] || 'circle'} />
            </span>
        )
);

export const TokenCoin: React.FC<{ token: Token; size?: number }> = ({ token, size = 18 }) => (
    <Icon id={tokenIconId(token)} size={size} title={TOKEN_NAME[token]} />
);

/** Render the `[icon:x]` effect mini-language outside a card face. */
export const IconLine: React.FC<{ text: string; size?: number }> = ({ text, size = 16 }) => (
    <span className="pk-iconline">
        {text.split(/(\[icon:[a-zA-Z0-9_-]+\])/g).map((part, i) => {
            const m = part.match(/^\[icon:([a-zA-Z0-9_-]+)\]$/);
            return m ? <Icon key={i} id={m[1]} size={size} /> : (part ? <span key={i}>{part}</span> : null);
        })}
    </span>
);

const CoinRun: React.FC<{ bag: Bag; size?: number }> = ({ bag, size = 16 }) => (
    <span className="pk-coinrun">
        {bagList(bag).map((t, i) => <TokenCoin key={i} token={t} size={size} />)}
    </span>
);

const pickable = (onClick?: () => void, selected?: boolean) => ({
    onClick,
    selectable: !!onClick,
    selected: !!selected,
    hoverable: !!onClick,
    selectedStyle: 'outline' as const,
    hoverStyle: 'offset' as const
});

interface CardProps { width: number; onClick?: () => void; selected?: boolean; dimmed?: boolean; }

/** Long Park names step down a size so they never clip on one line. */
const nameFit = (name: string): string => (name.length >= 18 ? 'name-xl' : name.length >= 15 ? 'name-l' : '');

export const ParkCardView: React.FC<CardProps & { parkId: string; need?: VisitOption['need']; bonus?: string | null }> = ({
    parkId, width, onClick, selected, dimmed, need, bonus
}) => (
    <div className={['pk-card pk-card-park', nameFit(PARK_BY_ID[parkId].short), dimmed ? 'dimmed' : ''].join(' ')}>
        <PlayingCard
            card={getParkCardDefinition(PARK_BY_ID[parkId], { need })}
            customIcons={PARKS_ICONS}
            width={`${width}px`}
            {...pickable(onClick, selected)}
        />
        {bonus && <span className="pk-card-bonus"><TokenCoin token={bonus as Token} size={Math.max(16, width * 0.2)} /></span>}
    </div>
);

export const GearCardView: React.FC<CardProps & { gearId: string; bonus?: string | null }> = ({
    gearId, width, onClick, selected, dimmed, bonus
}) => {
    const g = GEAR_BY_ID[gearId];
    return (
        <div className={['pk-card pk-card-gear', nameFit(g.name), dimmed ? 'dimmed' : ''].join(' ')}>
            <PlayingCard card={getGearCardDefinition(g)} customIcons={PARKS_ICONS} width={`${width}px`} {...pickable(onClick, selected)} />
            {bonus && <span className="pk-card-bonus"><TokenCoin token={bonus as Token} size={Math.max(14, width * 0.14)} /></span>}
        </div>
    );
};

/** Season of Heights: the token waiting on a Gear slot. */
const gearBonusAt = (game: any, slot: number | 'DECK'): string | null =>
    game.wildlife && slot !== 'DECK' ? game.wildlife.gearBonus[slot] : null;

export const CanteenCardView: React.FC<CardProps & { canteenId: string; filled: boolean }> = ({
    canteenId, filled, width, onClick, selected, dimmed
}) => (
    <div className={['pk-card pk-card-canteen', dimmed ? 'dimmed' : ''].join(' ')}>
        <PlayingCard
            card={getCanteenCardDefinition(canteenId, CANTEEN_BY_ID[canteenId].effect, filled)}
            customIcons={PARKS_ICONS}
            width={`${width}px`}
            {...pickable(onClick, selected)}
        />
    </div>
);

export const YearCardView: React.FC<CardProps & { yearId: string; progress?: number | null; photos?: number }> = ({
    yearId, width, onClick, selected
}) => (
    <div className="pk-card pk-card-year">
        <PlayingCard card={getYearCardDefinition(YEAR_BY_ID[yearId])} customIcons={PARKS_ICONS} width={`${width}px`} {...pickable(onClick, selected)} />
    </div>
);

const CardBack: React.FC<{ width: number; icon: string; count: number; onClick?: () => void; selected?: boolean; ratio?: number }> = ({
    width, icon, count, onClick, selected, ratio = 88.9 / 63.5
}) => (
    <button
        type="button"
        disabled={!onClick}
        className={['pk-back', selected ? 'selected' : ''].join(' ')}
        style={{ width, height: Math.round(width * ratio) }}
        onClick={onClick}
    >
        <Icon id={icon} size={Math.round(width * 0.42)} />
        <span>{count}</span>
    </button>
);

const EmptySlot: React.FC<{ width: number; ratio?: number; label?: string }> = ({ width, ratio = 88.9 / 63.5, label }) => (
    <div className="pk-empty" style={{ width, height: Math.round(width * ratio) }}>{label}</div>
);

/** Fit N cards to whatever width the container has (phone, debug pane, desktop). */
function useCardWidth(columns: number, gap: number, max: number): [React.RefObject<HTMLDivElement | null>, number] {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = React.useState(360);
    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const obs = new ResizeObserver(measure);
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return [ref, Math.min(max, Math.floor((width - gap * (columns - 1)) / columns))];
}

// ---------------------------------------------------------------------------
// Token picker — tap a coin to add it, tapping past what you hold clears it
// ---------------------------------------------------------------------------

interface TokenPickerProps {
    held: Record<Token, number>;
    value: Bag;
    limit: number;
    onChange: (bag: Bag) => void;
    tokens?: Token[];
    /** Ways this token can run out other than `held` (gain pickers: the supply). */
    disabled?: Partial<Record<Token, boolean>>;
}

const TokenPicker: React.FC<TokenPickerProps> = ({ held, value, limit, onChange, tokens = TOKENS, disabled = {} }) => {
    const total = TOKENS.reduce((n, t) => n + (value[t] || 0), 0);
    const tap = (t: Token) => {
        const cur = value[t] || 0;
        const next = cur >= (held[t] || 0) || total >= limit ? 0 : cur + 1;
        onChange({ ...value, [t]: next });
    };
    return (
        <div className="pk-picker">
            {tokens.map((t) => {
                const off = disabled[t] || (held[t] || 0) === 0;
                const cur = value[t] || 0;
                return (
                    <button type="button" key={t} className={['pk-picker-coin', cur > 0 ? 'on' : ''].join(' ')} disabled={off && cur === 0} onClick={() => tap(t)}>
                        <TokenCoin token={t} size={30} />
                        <span className="count">{cur > 0 ? cur : ''}<i>{held[t] || 0}</i></span>
                    </button>
                );
            })}
        </div>
    );
};

const bagSize = (b: Bag) => TOKENS.reduce((n, t) => n + (b[t] || 0), 0);

// ---------------------------------------------------------------------------
// Sheets — one per engine decision
// ---------------------------------------------------------------------------

interface SheetProps {
    game: any;
    me: any;
    respond: (answer: any) => void;
    onHide: () => void;
}

const Sheet: React.FC<{ title: string; sub?: React.ReactNode; onHide?: () => void; children: React.ReactNode }> = ({ title, sub, onHide, children }) => (
    <div className="pk-sheet-backdrop">
        <div className="pk-sheet">
            <div className="pk-sheet-head">
                <div>
                    <h4>{title}</h4>
                    {sub && <p>{sub}</p>}
                </div>
                {onHide && <button type="button" className="pk-link" onClick={onHide}>View board</button>}
            </div>
            {children}
        </div>
    </div>
);

const Choice: React.FC<{ onClick?: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <button type="button" className="pk-choice" disabled={disabled} onClick={onClick}>{children}</button>
);

const SkipButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Skip' }) => (
    <button type="button" className="pk-btn ghost" onClick={onClick}>{label}</button>
);

const CanteenSheet: React.FC<SheetProps> = ({ game, me, respond, onHide }) => {
    const p = game.prompt;
    const [ref, w] = useCardWidth(3, 8, 112);
    return (
        <Sheet
            title={p.free ? 'Fill a Canteen for free' : 'Fill a Canteen?'}
            sub={p.free ? 'Your Gear fills it with a Water straight from the supply.' : 'Pour a Water you gained this turn into a Canteen and take its reward.'}
            onHide={onHide}
        >
            <div className="pk-row wrap" ref={ref}>
                {p.canteens.map((i: number) => (
                    <div key={i} className="pk-labelled">
                        <CanteenCardView canteenId={me.canteens[i].id} filled={false} width={w} onClick={() => respond({ index: i })} />
                        <small>{CANTEEN_TEXT[CANTEEN_BY_ID[me.canteens[i].id].effect]}</small>
                    </div>
                ))}
            </div>
            <div className="pk-actions"><SkipButton label="Keep the Water" onClick={() => respond({ skip: true })} /></div>
        </Sheet>
    );
};

const SiteGainSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    return (
        <Sheet title={`At the ${SITES[p.site as SiteId].name}`} sub="Your Gear offers another option." onHide={onHide}>
            <div className="pk-choices">
                <Choice disabled={!p.printedOk} onClick={() => respond({})}><CoinRun bag={p.printed} size={24} /><span>Site reward</span></Choice>
                {p.gear.map((id: string) => (
                    <Choice key={id} onClick={() => respond({ gearId: id })}>
                        <CoinRun bag={GEAR_BY_ID[id].replace!.gain} size={24} /><span>{GEAR_BY_ID[id].name}</span>
                    </Choice>
                ))}
            </div>
        </Sheet>
    );
};

const VistaSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => (
    <Sheet title="At the Vista" onHide={onHide}>
        <div className="pk-choices">
            <Choice onClick={() => respond({ choice: 'CANTEEN' })}><Icon id="canteen" size={38} /><span>Draw a Canteen</span></Choice>
            <Choice onClick={() => respond({ choice: 'PHOTO' })}>
                <span className="pk-pair"><Icon id="photo" size={38} /><Icon id="camera" size={38} /></span>
                <span>Pay {game.prompt.photoCost} for a Photo and the Camera</span>
            </Choice>
        </div>
    </Sheet>
);

const AREA_LABEL: Record<Area, string> = { RESERVE: 'Reserve a Park', VISIT: 'Visit a Park', GEAR: 'Buy Gear' };
const AREA_ICON: Record<Area, string> = { RESERVE: 'reserve_glyph', VISIT: 'visit_glyph', GEAR: 'gear_glyph' };

const LookoutSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => (
    <Sheet title="At the Lookout" sub="Gear bought here gets no Trail End discount." onHide={onHide}>
        <div className="pk-choices">
            {game.prompt.options.map((a: Area) => (
                <Choice key={a} onClick={() => respond({ choice: a })}><Icon id={AREA_ICON[a]} size={34} /><span>{AREA_LABEL[a]}</span></Choice>
            ))}
        </div>
    </Sheet>
);

const CanteenChoiceSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => (
    <Sheet title="Canteen reward" onHide={onHide}>
        <div className="pk-choices">
            {game.prompt.options.includes('WILD') && (
                <Choice onClick={() => respond({ choice: 'WILD' })}><TokenCoin token="WILDLIFE" size={34} /><span>Pay 1 token for Wildlife</span></Choice>
            )}
            {game.prompt.options.includes('RESERVE') && (
                <Choice onClick={() => respond({ choice: 'RESERVE' })}><Icon id="park_glyph" size={34} /><span>Reserve a Park</span></Choice>
            )}
        </div>
        <div className="pk-actions"><SkipButton onClick={() => respond({ skip: true })} /></div>
    </Sheet>
);

const RiverSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => (
    <Sheet title="Follow the River" sub="Pay 1 Water to copy a Site with a Hiker on it. Copying is not a visit, so Gear won’t trigger." onHide={onHide}>
        <div className="pk-choices">
            {game.prompt.slots.map((slot: number) => {
                const site: SiteId = game.trail[slot - 1];
                return (
                    <Choice key={slot} onClick={() => respond({ slot })}>
                        <span className="pk-thumb"><Icon id={siteIconId(site)} size={44} /></span>
                        <span>{SITES[site].name}<small>{SITES[site].text}</small></span>
                    </Choice>
                );
            })}
        </div>
    </Sheet>
);

const PAY_TITLE: Record<string, string> = {
    VISTA: 'Pay for a Photo', LENS: 'Take a Photo?', CAMERA: 'Season-end Photo?', WILD: 'Pay for Wildlife', SNAP: 'Take a Photo?'
};
const PAY_SUB: Record<string, string> = {
    VISTA: 'You also take the Camera.', LENS: 'Your lens is ready. The Camera stays where it is.',
    CAMERA: 'As Camera holder you may take one Photo for 1 token.', WILD: 'Any token will do.',
    SNAP: 'Season of Connecting: you joined your own Hiker, so a Photo costs just 1 token.'
};

const PaySheet: React.FC<SheetProps> = ({ game, me, respond, onHide }) => {
    const p = game.prompt;
    const [pay, setPay] = React.useState<Bag>({});
    return (
        <Sheet title={PAY_TITLE[p.purpose]} sub={`${PAY_SUB[p.purpose]} Choose ${p.count} token${p.count === 1 ? '' : 's'}.`} onHide={onHide}>
            <TokenPicker held={me.tokens} value={pay} limit={p.count} onChange={setPay} />
            <div className="pk-actions">
                {p.optional && <SkipButton label="No thanks" onClick={() => respond({ skip: true })} />}
                <button type="button" className="pk-btn primary" disabled={bagSize(pay) !== p.count} onClick={() => respond({ pay })}>Pay</button>
            </div>
        </Sheet>
    );
};

const ExchangeSheet: React.FC<SheetProps> = ({ game, me, respond, onHide }) => {
    const p = game.prompt;
    const [pay, setPay] = React.useState<Bag>({});
    const [gain, setGain] = React.useState<Bag>({});
    const paid = SYMS.filter(t => pay[t]);
    const offered = SYMS.filter(t => !pay[t]);
    const disabled: Partial<Record<Token, boolean>> = {};
    SYMS.forEach((t) => { disabled[t] = game.supply[t] === 0; });
    const cleanGain = (next: Bag) => setGain(next);
    const count = bagSize(pay);
    React.useEffect(() => {
        if (bagSize(gain) > count) setGain({});
        else if (paid.some(t => gain[t])) {
            const copy = { ...gain };
            paid.forEach((t) => { delete copy[t]; });
            setGain(copy);
        }
    }, [pay]);
    return (
        <Sheet title="Trade tokens" sub="Turn in 1 or 2 tokens, then take the same number of other types. No Wildlife." onHide={onHide}>
            <label className="pk-label">Turn in</label>
            <TokenPicker held={me.tokens} value={pay} limit={2} onChange={setPay} />
            <label className="pk-label">Take</label>
            <TokenPicker held={game.supply} value={gain} limit={count} onChange={cleanGain} tokens={offered} disabled={disabled} />
            <div className="pk-actions">
                {p.optional && <SkipButton onClick={() => respond({ skip: true })} />}
                <button type="button" className="pk-btn primary" disabled={count === 0 || bagSize(gain) !== count} onClick={() => respond({ pay, gain })}>Trade</button>
            </div>
        </Sheet>
    );
};

const ReserveSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const [ref, w] = useCardWidth(4, 6, 104);
    return (
        <Sheet title="Reserve a Park" sub="Take a face-up Park or try your luck on the top of the deck. Reserved Parks score once visited." onHide={onHide}>
            <div className="pk-row" ref={ref}>
                {game.parksBoard.map((id: string | null, i: number) => id
                    ? <ParkCardView key={id} parkId={id} width={w} bonus={game.parkBonus[i]} onClick={() => respond({ source: i })} />
                    : <EmptySlot key={i} width={w} />)}
                <CardBack width={w} icon="park_glyph" count={game.prompt.deck} onClick={game.prompt.deck > 0 ? () => respond({ source: 'DECK' }) : undefined} />
            </div>
            <div className="pk-actions"><SkipButton onClick={() => respond({ skip: true })} /></div>
        </Sheet>
    );
};

const VisitSheet: React.FC<SheetProps> = ({ game, me, respond, onHide }) => {
    const p = game.prompt;
    const options: VisitOption[] = p.options;
    const [ref, w] = useCardWidth(3, 8, 118);
    const [picked, setPicked] = React.useState<string | null>(null);
    const [pay, setPay] = React.useState<Bag>({});
    const choose = (o: VisitOption) => {
        if (!o.suggestion) return;
        setPicked(o.parkId);
        setPay(o.suggestion);
    };
    const current = options.find(o => o.parkId === picked);
    const deck = options.find(o => o.source === 'DECK');
    const guided = me.gear.some((id: string) => GEAR_BY_ID[id].wildPair);
    const held = { ...me.tokens };
    if (current && current.bonus) held[current.bonus] += 1;
    const total = current ? SYMS.reduce((n, s) => n + (current.need[s] || 0), current.need.ANY || 0) : 0;
    const valid = !!current && coversPayment(current.need, pay, me.gear);
    const row = (source: 'BOARD' | 'RESERVED', label: string) => {
        const list = options.filter(o => o.source === source);
        if (list.length === 0) return null;
        return (
            <>
                <label className="pk-label">{label}</label>
                <div className="pk-row scroll">
                    {list.map((o) => (
                        <ParkCardView
                            key={o.parkId} parkId={o.parkId} width={w} need={o.need} bonus={o.bonus}
                            dimmed={!o.suggestion} selected={picked === o.parkId}
                            onClick={o.suggestion ? () => choose(o) : undefined}
                        />
                    ))}
                </div>
            </>
        );
    };
    return (
        <Sheet title={p.extra ? 'Park Pass: visit another?' : 'Visit a Park'} sub="Hollow coins are covered by your Gear or the Season." onHide={onHide}>
            <div ref={ref} className="pk-measure" />
            {row('BOARD', 'On the board')}
            {row('RESERVED', 'Reserved')}
            {deck && (
                <>
                    <label className="pk-label">Top of the deck, unseen</label>
                    <div className="pk-row">
                        <CardBack width={w} icon="park_glyph" count={game.parksDeck} selected={picked === 'DECK'} onClick={deck.suggestion ? () => choose(deck) : undefined} />
                    </div>
                </>
            )}
            {current && (
                <>
                    <label className="pk-label">
                        {guided ? `Pay for ${total} icon${total === 1 ? '' : 's'} (a Field Guide lets one Wildlife pay for two)` : `Pay ${total} token${total === 1 ? '' : 's'}`}
                        {current.bonus ? ' (includes this Park’s bonus)' : ''}
                    </label>
                    <TokenPicker held={held} value={pay} limit={total} onChange={setPay} />
                </>
            )}
            <div className="pk-actions">
                <SkipButton onClick={() => respond({ skip: true })} />
                <button type="button" className="pk-btn primary" disabled={!valid} onClick={() => respond({ parkId: picked, payment: pay })}>Visit</button>
            </div>
        </Sheet>
    );
};

const BuySheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    const options: BuyOption[] = p.options;
    const [ref, w] = useCardWidth(3, 8, 130);
    return (
        <Sheet title="Buy Gear" sub={p.discount ? 'First to arrive: this Gear costs 1 less Sunshine.' : 'Pay Sunshine for one card.'} onHide={onHide}>
            <div className="pk-row" ref={ref}>
                {options.map((o) => (
                    <div className="pk-labelled" key={o.slot}>
                        {o.gearId
                            ? <GearCardView gearId={o.gearId} width={w} dimmed={!o.ok} bonus={gearBonusAt(game, o.slot)} onClick={o.ok ? () => respond({ slot: o.slot }) : undefined} />
                            : <CardBack width={w} ratio={GEAR_RATIO} icon="gear_glyph" count={game.gearDeck} onClick={o.ok ? () => respond({ slot: o.slot }) : undefined} />}
                        <small className="pk-coinline">Pay {o.cost} <TokenCoin token="SUNSHINE" size={13} /></small>
                        <small>{o.gearId ? gearText(GEAR_BY_ID[o.gearId]) : 'The top card of the deck, unseen.'}</small>
                    </div>
                ))}
            </div>
            <div className="pk-actions"><SkipButton onClick={() => respond({ skip: true })} /></div>
        </Sheet>
    );
};

const DiscardSheet: React.FC<SheetProps> = ({ game, me, respond, onHide }) => {
    const p = game.prompt;
    const [bag, setBag] = React.useState<Bag>({});
    return (
        <Sheet title={`Too many tokens`} sub={`You may keep ${TOKEN_LIMIT}. Discard ${p.count}.`} onHide={onHide}>
            <TokenPicker held={me.tokens} value={bag} limit={p.count} onChange={setBag} />
            <div className="pk-actions">
                <button type="button" className="pk-btn primary" disabled={bagSize(bag) !== p.count} onClick={() => respond({ discard: bag })}>Discard</button>
            </div>
        </Sheet>
    );
};

const CampSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    const site = p.site as SiteId;
    const tents = p.options.map((o: CampOption) => (
        <Choice key={String(o.spot)} onClick={() => respond({ choice: o.spot })}>
            <span className="pk-thumb"><Icon id="tent" size={40} /></span>
            <span>{campName(game, o.spot)}<small>{nfActionText(o.action)}</small></span>
        </Choice>
    ));
    if (!p.slot) {
        return (
            <Sheet title="Pitch a Tent" sub="Your Park’s Instant Action: choose an open Campsite and take its action." onHide={onHide}>
                <div className="pk-choices">{tents}</div>
                <div className="pk-actions"><SkipButton onClick={() => respond({ skip: true })} /></div>
            </Sheet>
        );
    }
    return (
        <Sheet title={`A Tent at the ${SITES[site].name}`} sub="Take the Site as usual, or carry its Tent to a Campsite and take that action instead. Campers don’t take the Weather token." onHide={onHide}>
            <div className="pk-choices">
                <Choice disabled={!p.siteOk} onClick={() => respond({ choice: 'SITE' })}>
                    <span className="pk-thumb"><Icon id={siteIconId(site)} size={44} /></span>
                    <span>Take the {SITES[site].name}<small>{SITES[site].text}{p.weather ? ' With its Weather token.' : ''}</small></span>
                </Choice>
                {tents}
            </div>
        </Sheet>
    );
};

const NfPaySheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    const a: NfAction = p.action;
    const times = a.kind === 'TRADE' || a.kind === 'PHOTO' ? a.times : 1;
    const again = p.left < times;
    return (
        <Sheet title={a.kind === 'PHOTO' ? 'Take a Photo' : 'Trade'} sub={`${nfActionText(a)}${again ? ` ${p.left} more allowed.` : ''} Wildlife can stand in for any token.`} onHide={onHide}>
            <div className="pk-choices">
                {p.tokens.map((t: Token) => (
                    <Choice key={t} onClick={() => respond({ token: t })}>
                        <TokenCoin token={t} size={34} />
                        <span>Turn in a {TOKEN_NAME[t]}</span>
                    </Choice>
                ))}
            </div>
            {p.optional && <div className="pk-actions"><SkipButton label={again ? 'Done' : 'Skip'} onClick={() => respond({ skip: true })} /></div>}
        </Sheet>
    );
};

/** Return one of your cards, then take one: two picks, one confirm. */
const NfSwapSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    const [ref, w] = useCardWidth(4, 6, 104);
    const [give, setGive] = React.useState<{ type: 'GEAR' | 'YEAR'; id: string } | null>(null);
    const [take, setTake] = React.useState<string | number | null>(null);
    const isGive = (type: string, id: string) => !!give && give.type === type && give.id === id;
    return (
        <Sheet title="Swap a card" sub="Return a Gear or Year card to the bottom of its deck, then take the top Year card, the top Gear card or any face-up Gear." onHide={onHide}>
            <div ref={ref} className="pk-measure" />
            <label className="pk-label">Return</label>
            <div className="pk-row scroll">
                {p.gear.map((id: string) => <GearCardView key={id} gearId={id} width={w} selected={isGive('GEAR', id)} onClick={() => setGive({ type: 'GEAR', id })} />)}
                {p.years.map((id: string) => <YearCardView key={id} yearId={id} width={w} selected={isGive('YEAR', id)} onClick={() => setGive({ type: 'YEAR', id })} />)}
            </div>
            <label className="pk-label">Take</label>
            <div className="pk-row scroll">
                <CardBack width={w} icon="year_glyph" count={p.yearDeck} selected={take === 'YEAR'} onClick={p.yearDeck > 0 ? () => setTake('YEAR') : undefined} />
                <CardBack width={w} icon="gear_glyph" count={p.gearDeck} selected={take === 'GEAR_DECK'} onClick={p.gearDeck > 0 ? () => setTake('GEAR_DECK') : undefined} />
                {p.board.map((g: { slot: number; gearId: string }) => (
                    <GearCardView key={g.slot} gearId={g.gearId} width={w} selected={take === g.slot} onClick={() => setTake(g.slot)} />
                ))}
            </div>
            <div className="pk-actions">
                <button type="button" className="pk-btn primary" disabled={!give || take === null} onClick={() => respond({ discard: give, take })}>Swap</button>
            </div>
        </Sheet>
    );
};

const NfGearPickSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    const [ref, w] = useCardWidth(4, 6, 118);
    return (
        <Sheet title="Take a Gear card" sub={`${p.fresh ? 'Fresh Gear is out. ' : ''}Take a face-up Gear, or the top card of the deck, for free.`} onHide={onHide}>
            <div className="pk-row" ref={ref}>
                {p.board.map((g: { slot: number; gearId: string }) => (
                    <GearCardView key={g.slot} gearId={g.gearId} width={w} onClick={() => respond({ take: g.slot })} />
                ))}
                <CardBack width={w} icon="gear_glyph" count={p.gearDeck} onClick={p.gearDeck > 0 ? () => respond({ take: 'DECK' }) : undefined} />
            </div>
            <div className="pk-actions"><SkipButton onClick={() => respond({ skip: true })} /></div>
        </Sheet>
    );
};

const NfYearReturnSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    const [ref, w] = useCardWidth(3, 8, 118);
    return (
        <Sheet title="Return a Year card" sub={`You drew ${p.drawn.length}. Return any one card from your hand to the bottom of the deck. Copies of the same card only score once.`} onHide={onHide}>
            <div className="pk-row wrap" ref={ref}>
                {p.years.map((id: string) => (
                    <div className="pk-labelled" key={id}>
                        <YearCardView yearId={id} width={w} onClick={() => respond({ yearId: id })} />
                        <small>{p.drawn.includes(id) ? 'New · ' : ''}{YEAR_BY_ID[id].text}</small>
                    </div>
                ))}
            </div>
        </Sheet>
    );
};

const RangerCampSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    return (
        <Sheet title="The Ranger found a Tent" sub={`The back Ranger stopped at the ${SITES[p.site as SiteId].name}, where there is both Weather and a Tent. Choose which it takes.`} onHide={onHide}>
            <div className="pk-choices">
                <Choice onClick={() => respond({ choice: 'WEATHER' })}><TokenCoin token={p.weather} size={34} /><span>The Weather token</span></Choice>
                <Choice onClick={() => respond({ choice: 'CAMP' })}><Icon id="tent" size={34} /><span>The Tent, closing it for the Season</span></Choice>
            </div>
        </Sheet>
    );
};

const ShutterSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => {
    const p = game.prompt;
    return (
        <Sheet title="Upgraded Shutter" sub={`You gained ${p.count} Wildlife. You may take a Photo instead of ${p.count === 1 ? 'it' : 'any of them'}.`} onHide={onHide}>
            <div className="pk-choices">
                {Array.from({ length: p.count }, (_, i) => i + 1).map(k => (
                    <Choice key={k} onClick={() => respond({ swap: k })}>
                        <span className="pk-pair"><TokenCoin token="WILDLIFE" size={30} /><Icon id="arrow" size={20} /><Icon id="photo" size={30} /></span>
                        <span>{k === 1 ? 'Take a Photo instead' : `Swap ${k} for Photos`}</span>
                    </Choice>
                ))}
            </div>
            <div className="pk-actions"><SkipButton label="Keep the Wildlife" onClick={() => respond({ skip: true })} /></div>
        </Sheet>
    );
};

const LakeSheet: React.FC<SheetProps> = ({ game, me, respond, onHide }) => {
    const p = game.prompt;
    const [ref, w] = useCardWidth(3, 8, 112);
    return (
        <Sheet title="At the Lake" sub="Take the reward of one of your filled Canteens again. It stays filled." onHide={onHide}>
            <div className="pk-row wrap" ref={ref}>
                {p.canteens.map((i: number) => (
                    <div key={i} className="pk-labelled">
                        <CanteenCardView canteenId={me.canteens[i].id} filled width={w} onClick={() => respond({ index: i })} />
                        <small>{CANTEEN_TEXT[CANTEEN_BY_ID[me.canteens[i].id].effect]}</small>
                    </div>
                ))}
            </div>
        </Sheet>
    );
};

const ParkwaySheet: React.FC<SheetProps> = ({ game, respond, onHide }) => (
    <Sheet title="Take the Parkway" sub="Everyone else has gained a Sunshine. Take the action of any Site with no Hiker on it. It isn’t a visit, so Gear won’t trigger." onHide={onHide}>
        <div className="pk-choices">
            {game.prompt.slots.map((slot: number) => {
                const site: SiteId = game.trail[slot - 1];
                return (
                    <Choice key={slot} onClick={() => respond({ slot })}>
                        <span className="pk-thumb"><Icon id={siteIconId(site)} size={44} /></span>
                        <span>{SITES[site].name}<small>{SITES[site].text}</small></span>
                    </Choice>
                );
            })}
        </div>
    </Sheet>
);

const SummitSheet: React.FC<SheetProps> = ({ game, respond, onHide }) => (
    <Sheet title="At the Summit" sub="Turn in a Photo and take one token." onHide={onHide}>
        <div className="pk-choices">
            {game.prompt.tokens.map((t: Token) => (
                <Choice key={t} onClick={() => respond({ token: t })}>
                    <span className="pk-pair"><Icon id="photo" size={30} /><Icon id="arrow" size={20} /><TokenCoin token={t} size={30} /></span>
                    <span>Gain a {TOKEN_NAME[t]}</span>
                </Choice>
            ))}
        </div>
    </Sheet>
);

const PROMPT_TITLE: Record<string, string> = {
    CANTEEN: 'Canteen', SITE_GAIN: 'Site reward', VISTA: 'Vista', LOOKOUT: 'Lookout', CANTEEN_CHOICE: 'Canteen reward', RIVER: 'River',
    PAY: 'Payment', EXCHANGE: 'Trade', RESERVE: 'Reserve a Park', VISIT: 'Visit a Park', BUY: 'Buy Gear', DISCARD: 'Discard',
    CAMP: 'A Tent', NF_PAY: 'Campsite action', NF_SWAP: 'Swap a card', NF_GEAR_PICK: 'Take a Gear card', NF_YEAR_RETURN: 'Return a Year card', RANGER_CAMP: 'The Ranger',
    SHUTTER: 'Upgraded Shutter', LAKE: 'Lake', PARKWAY: 'Parkway', SUMMIT: 'Summit'
};

// ---------------------------------------------------------------------------
// The Trail
// ---------------------------------------------------------------------------

/** Stages of a new Season: the reveal covers the screen, then the Trail is dealt. */
type SeasonIntroStage = 'reveal' | 'deal' | null;

interface TrailProps {
    intro?: SeasonIntroStage;
    game: any;
    accents: Record<string, string>;
    icons: Record<string, number>;
    moves: MoveOptions | null;
    hiker: number | null;
    dest: number | Area | null;
    myId: string;
    onPick: (dest: number | Area) => void;
}

/** `movingKey` names the Hiker the current player has lined up to move. */
function pawnsAt(game: any, accents: Record<string, string>, icons: Record<string, number>, slot: number, movingKey?: string) {
    const out: { key: string; accent: string; icon?: number; ranger?: boolean; moving?: boolean }[] = [];
    game.order.forEach((id: string) => {
        game.players[id].hikers.forEach((pos: number, i: number) => {
            const key = `${id}-${i}`;
            if (pos === slot) out.push({ key, accent: accents[id], icon: icons[id], moving: key === movingKey });
        });
    });
    if (game.solo) {
        game.solo.rangers.forEach((pos: number, i: number) => {
            if (pos === slot) out.push({ key: `r${i}`, accent: '#2c5a44', ranger: true });
        });
    }
    return out;
}

/** A Site as a real card; pawns and Weather are game pieces sitting on top of it. */
const SiteCard: React.FC<{
    site: SiteId | null; width: number; pawns: ReturnType<typeof pawnsAt>; weather?: Token | null;
    campfire?: boolean; blocked?: boolean; picked?: boolean; title?: string; onClick?: () => void; camp?: boolean;
}> = ({ site, width, pawns, weather, campfire, blocked, picked, title, onClick, camp }) => (
    <div className={['pk-card pk-card-site', blocked ? 'dimmed' : '', picked ? 'picked' : ''].join(' ')} title={title}>
        <PlayingCard card={getSiteCardDefinition(site)} customIcons={PARKS_ICONS} width={`${width}px`} {...pickable(onClick, picked)} />
        <span className={['pawns', weather ? 'beside-weather' : ''].join(' ')}>{pawns.map(p => <Pawn key={p.key} accent={p.accent} icon={p.icon} ranger={p.ranger} moving={p.moving} size={Math.round(width * 0.18)} />)}</span>
        {weather && <span className="weather"><TokenCoin token={weather} size={Math.round(width * 0.27)} /></span>}
        {campfire && <span className="fire"><Icon id="campfire" size={Math.round(width * 0.24)} /></span>}
        {camp && <span className="camp"><Icon id="tent" size={Math.round(width * 0.27)} title="A Tent: camp here instead of taking the Site" /></span>}
    </div>
);

const Trail: React.FC<TrailProps> = ({ intro, game, accents, icons, moves, hiker, dest, myId, onPick }) => {
    const options = moves && hiker !== null ? moves.hikers[hiker].sites : null;
    const movingKey = moves && hiker !== null ? `${myId}-${hiker}` : undefined;
    // Start and Trail End take a cell each, so a full Trail needs the wider grid to stay on two rows
    const cols = game.trail.length + 2 > 10 ? 6 : 5;
    const [ref, w] = useCardWidth(cols, 5, 96);
    return (
        <div ref={ref} className={['pk-trail', intro === 'reveal' ? 'waiting' : '', intro === 'deal' ? 'dealing' : ''].join(' ')} style={{ gridTemplateColumns: `repeat(${cols}, ${w}px)` }}>
            <SiteCard site={null} width={w} pawns={pawnsAt(game, accents, icons, 0, movingKey)} title="Start" />
            {game.trail.map((site: SiteId, i: number) => {
                const slot = i + 1;
                const info = options ? options[slot] : undefined;
                return (
                    <SiteCard
                        key={slot} site={site} width={w} pawns={pawnsAt(game, accents, icons, slot, movingKey)} weather={game.weather[i]}
                        camp={!!game.nightfall && !!game.nightfall.camps[i]}
                        campfire={!!info && !!info.campfire} blocked={!!info && !info.ok} picked={dest === slot}
                        title={(info && info.reason) || SITES[site].name}
                        onClick={info && info.ok ? () => onPick(slot) : undefined}
                    />
                );
            })}
            <TrailEnd game={game} accents={accents} icons={icons} moves={moves} dest={dest} width={w} onPick={onPick} />
        </div>
    );
};

/** One card holding the three Trail End areas, each its own tap target. */
const TrailEnd: React.FC<Pick<TrailProps, 'game' | 'accents' | 'icons' | 'moves' | 'dest' | 'onPick'> & { width: number }> = ({ game, accents, icons, moves, dest, width, onPick }) => {
    const te = game.trailEnd;
    const lists: Record<Area, string[]> = { RESERVE: te.reserve, GEAR: te.gear, VISIT: te.visit };
    const pawn = Math.round(width * 0.18);
    return (
        <div className="pk-card pk-card-end">
            <PlayingCard card={getTrailEndCardDefinition()} customIcons={PARKS_ICONS} width={`${width}px`} />
            <div className="areas" style={{ borderRadius: width * 3.4 / 63.5 }}>
                {AREAS.map((a) => {
                    const area = moves ? moves.areas[a] : null;
                    const ok = !!area && area.ok;
                    const pawns: { key: string; accent: string; icon?: number; ranger?: boolean }[] = lists[a].map((id: string, i: number) => ({ key: `${id}-${i}`, accent: accents[id], icon: icons[id] }));
                    if (a === 'RESERVE' && te.firstSlot === 'RANGER') pawns.push({ key: 'ranger', accent: '#2c5a44', ranger: true });
                    // a crowded area squeezes its pawns together rather than running off the card
                    const step = pawns.length > 1 ? Math.min(pawn * 0.75, (width * 0.9 - pawn) / (pawns.length - 1)) : 0;
                    const cls = ['area', a.toLowerCase(), dest === a ? 'picked' : '', (moves && !ok) || (area && !area.possible) ? 'faint' : ''].join(' ');
                    const waiting: Token | null = game.wildlife ? game.wildlife.endBonus[a] : null;
                    return (
                        <button type="button" key={a} className={cls} disabled={!ok} aria-label={AREA_LABEL[a]} title={AREA_LABEL[a]} onClick={() => onPick(a)}>
                            <Icon id={AREA_ICON[a]} size={Math.round(width * 0.38)} />
                            {waiting && <span className="season-tok"><TokenCoin token={waiting} size={Math.round(width * 0.2)} /></span>}
                            {a === 'RESERVE' && te.firstSlot === null && <span className="extra"><Icon id="marker" size={Math.round(width * 0.27)} title="First Hiker Marker" /></span>}
                            {a === 'GEAR' && area && area.discount > 0 && <span className="extra bonus">−1<TokenCoin token="SUNSHINE" size={Math.round(width * 0.2)} /></span>}
                            <span className="pawns">
                                {pawns.map((p, i) => (
                                    <span key={p.key} style={{ marginLeft: i ? step - pawn : 0 }}><Pawn accent={p.accent} icon={p.icon} ranger={p.ranger} size={pawn} /></span>
                                ))}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const SoloPanel: React.FC<{ game: any }> = ({ game }) => {
    const solo = game.solo;
    const ev = EVENT_BY_ID[solo.activeEvent];
    const te = game.trailEnd;
    const pips = (n: number, token: Token) => [0, 1, 2].map(i => (
        <span key={i} className={['pk-pip', i < n ? 'on' : ''].join(' ')}>{i < n && <TokenCoin token={token} size={14} />}</span>
    ));
    return (
        <div className="pk-panel pk-solo">
            <div className="pk-solo-track">
                <div className="pk-solo-row">{pips(solo.tracker.SUNSHINE, 'SUNSHINE')}<span>{EVENT_OP_TEXT[ev.sunshine]}</span></div>
                <div className="pk-solo-row">{pips(solo.tracker.WATER, 'WATER')}<span>{EVENT_OP_TEXT[ev.water]}</span></div>
            </div>
            <div className="pk-solo-meta">
                <strong>{ev.name}</strong>
                <span>Rangers home: {[te.rangerTop, te.rangerMiddle, te.rangerBottom].filter(Boolean).length}</span>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Nightfall: the Campsites
// ---------------------------------------------------------------------------

const CAMP_BOARD_NAME = 'Campsite board';

const campName = (game: any, spot: CampSpot): string =>
    spot === 'BOARD' ? CAMP_BOARD_NAME : CAMPSITE_BY_ID[game.nightfall.campsites[spot].tile].name;

/** A Campsite: its action in icons, and a ring per Tent it can take, filled once pitched. */
const CampsiteTile: React.FC<{ name: string; action: NfAction; slots: number; taken: number; onClick?: () => void }> = ({ name, action, slots, taken, onClick }) => (
    <button type="button" className={['pk-campsite', taken >= slots ? 'full' : ''].join(' ')} onClick={onClick} title={nfActionText(action)}>
        <small>{name}</small>
        <IconLine text={nfActionLine(action)} size={18} />
        <span className="tents">
            {Array.from({ length: slots }, (_, i) => (
                i < taken ? <Icon key={i} id="tent" size={18} title="Taken this Season" /> : <i key={i} />
            ))}
        </span>
    </button>
);

const CampsitePanel: React.FC<{ game: any; onDetail: (d: Detail) => void }> = ({ game, onDetail }) => {
    const nf = game.nightfall;
    return (
        <div className="pk-panel pk-camps">
            <CampsiteTile
                name={CAMP_BOARD_NAME} action={CAMPSITE_BOARD_ACTION} slots={nf.boardSlots} taken={nf.boardTaken}
                onClick={() => onDetail({ campsite: { name: CAMP_BOARD_NAME, action: CAMPSITE_BOARD_ACTION } })}
            />
            {nf.campsites.map((c: any) => {
                const tile = CAMPSITE_BY_ID[c.tile];
                return (
                    <CampsiteTile
                        key={c.tile} name={tile.name} action={c.action} slots={1} taken={c.taken ? 1 : 0}
                        onClick={() => onDetail({ campsite: { name: tile.name, action: c.action, tile: c.tile } })}
                    />
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Player summaries
// ---------------------------------------------------------------------------

const KIT_CARD_W = 62;
const KIT_GEAR_W = 72;
const KIT_ICON = 20;

/**
 * What a player carries, the same on every page: Canteens and Gear on the left,
 * scrolling together; tokens in a 2×3 block on the right; then a column for the
 * Campfire, First Hiker Marker and Camera. Each piece keeps its place, faded when not held.
 */
const PlayerKit: React.FC<{ game: any; player: any; id: string; onDetail: (d: Detail) => void }> = ({ game, player, id, onDetail }) => {
    const hasMarker = game.firstHikerOwner === id;
    const hasCamera = game.cameraOwner === id;
    return (
        <div className="pk-kit">
            <div className="pk-kit-cards">
                {player.canteens.map((c: any) => (
                    <CanteenCardView key={c.id} canteenId={c.id} filled={c.filled} width={KIT_CARD_W} onClick={() => onDetail({ canteen: c })} />
                ))}
                {player.gear.length > 0 && <span className="pk-kit-rule" />}
                {player.gear.map((g: string) => <GearCardView key={g} gearId={g} width={KIT_GEAR_W} onClick={() => onDetail({ gear: g })} />)}
            </div>
            <div className="pk-kit-tokens">
                {TOKENS.map(t => (
                    <span className={['pk-tok', player.tokens[t] === 0 ? 'zero' : ''].join(' ')} key={t}>
                        <TokenCoin token={t} size={KIT_ICON} /><b>{player.tokens[t]}</b>
                    </span>
                ))}
                <span className={['pk-tok', player.photos === 0 ? 'zero' : ''].join(' ')}><Icon id="photo" size={KIT_ICON} title="Photos" /><b>{player.photos}</b></span>
            </div>
            <div className="pk-kit-status">
                <Icon id={player.campfireLit ? 'campfire' : 'campfire_out'} size={KIT_ICON} title={player.campfireLit ? 'Campfire lit' : 'Campfire out'} />
                <span className={hasMarker ? '' : 'off'}><Icon id="marker" size={KIT_ICON} title={hasMarker ? 'Holds the First Hiker Marker' : 'First Hiker Marker'} /></span>
                <span className={hasCamera ? '' : 'off'}><Icon id="camera" size={KIT_ICON} title={hasCamera ? 'Holds the Camera' : 'Camera'} /></span>
            </div>
        </div>
    );
};

const CARD_STRIP_W = 86;

const parkPoints = (parks: string[]) => parks.reduce((n, x) => n + PARK_BY_ID[x].points, 0);

const ParkStrip: React.FC<{ title: string; parks: string[]; onDetail: (d: Detail) => void }> = ({ title, parks, onDetail }) => (
    <div className="pk-section">
        <h5>{title} <span>{parkPoints(parks)} pts</span></h5>
        <div className={['pk-row', parks.length ? 'scroll' : 'none'].join(' ')}>
            {parks.map((id) => <ParkCardView key={id} parkId={id} width={CARD_STRIP_W} onClick={() => onDetail({ park: id })} />)}
        </div>
    </div>
);

/** One player's whole table presence. `view_for` withholds a rival's Year card until the game ends. */
const Tableau: React.FC<{
    game: any; p: any; id: string; name: string; accent: string; icon: number; onDetail: (d: Detail) => void;
}> = ({ game, p, id, name, accent, icon, onDetail }) => (
    <div className="pk-panel pk-tableau">
        <div className="pk-tableau-head">
            <Pawn accent={accent} icon={icon} size={24} />
            <b>{name}</b>
            <span className="pk-spacer" />
            <b>{game.phase === Phase.Over ? game.scores[id].total : p.score} pts</b>
        </div>
        {(p.years && p.years.length ? p.years : p.year ? [{ id: p.year, progress: p.yearProgress, points: p.yearPoints }] : []).map((y: any) => (
            <div className="pk-yearline" key={y.id}>
                <YearCardView
                    yearId={y.id} width={118}
                    onClick={() => onDetail({ year: { id: y.id, progress: y.progress, photos: p.photos, points: y.points, accent, icon } })}
                />
                <div>
                    <p>{YEAR_BY_ID[y.id].text}</p>
                    <p className="pk-progress">
                        Now at <b>{y.progress}</b>, worth <b>{y.points}</b> point{y.points === 1 ? '' : 's'}.
                    </p>
                </div>
            </div>
        ))}
        {p.years && p.years.length > 1 && (
            <p className="pk-sub">All your Year cards add up to <b>{p.yearTotal}</b> point{p.yearTotal === 1 ? '' : 's'}. Copies of one card count once.</p>
        )}
        {!p.year && game.nightfall && p.yearCount > 0 && (
            <p className="pk-sub pk-facedown"><Icon id="year_glyph" size={20} /> {p.yearCount} Year card{p.yearCount === 1 ? '' : 's'}, face down</p>
        )}
        <PlayerKit game={game} player={p} id={id} onDetail={onDetail} />
        {p.reserved.length > 0 && <ParkStrip title="Reserved" parks={p.reserved} onDetail={onDetail} />}
        <ParkStrip title="Visited" parks={p.visited} onDetail={onDetail} />
    </div>
);

interface Detail {
    park?: string;
    gear?: string;
    site?: SiteId;
    canteen?: { id: string; filled: boolean };
    event?: { name: string; text: string };
    year?: { id: string; progress: number; photos: number; points: number; accent: string; icon: number };
    yearOption?: string;
    campsite?: { name: string; action: NfAction; tile?: string };
}

/** A rail from nothing to the top tier: a tick per tier, and the player's piece at their count. */
const YearTrack: React.FC<{
    iconId: string; value: number; ticks: { at: number; points: number }[]; accent: string; icon: number;
}> = ({ iconId, value, ticks, accent, icon }) => {
    const top = ticks[ticks.length - 1].at;
    const pos = (n: number) => `${Math.min(n, top) / top * 100}%`;
    return (
        <div className="pk-year-track">
            <Icon id={iconId} size={24} />
            <div className="bar">
                <span className="rail" />
                <span className="fill" style={{ width: pos(value), background: accent }} />
                {ticks.map(t => (
                    <span key={t.at} className={['tick', value >= t.at ? 'met' : ''].join(' ')} style={{ left: pos(t.at) }}>
                        <i style={value >= t.at ? { background: accent } : undefined} />
                        <b>{t.at}</b>
                        <small>{t.points} pts</small>
                    </span>
                ))}
                <span className="marker" style={{ left: pos(value) }}>
                    <b>{value}</b>
                    <Pawn accent={accent} icon={icon} size={20} />
                </span>
            </div>
        </div>
    );
};

const YearProgress: React.FC<{ year: NonNullable<Detail['year']> }> = ({ year }) => {
    const card = YEAR_BY_ID[year.id];
    const next = yearNextStep(card, year.progress, year.photos);
    const photoTicks = card.tiers.filter(t => t.photos).map(t => ({ at: t.photos!, points: t.points }));
    // Nightfall pays every step: show the steps reached and the next two
    const steps = card.rate ? Math.floor(year.progress / card.rate.per) + 2 : 0;
    const ticks = card.rate
        ? Array.from({ length: steps }, (_, i) => ({ at: (i + 1) * card.rate!.per, points: (i + 1) * card.rate!.points }))
        : card.tiers.map(t => ({ at: t.threshold, points: t.points }));
    return (
        <div className="pk-year-progress">
            <YearTrack iconId={yearTrackIcon(card)} value={year.progress} ticks={ticks} accent={year.accent} icon={year.icon} />
            {photoTicks.length > 0 && <YearTrack iconId="photo" value={year.photos} ticks={photoTicks} accent={year.accent} icon={year.icon} />}
            <p><b>Worth {year.points} point{year.points === 1 ? '' : 's'} now.</b> {next ? `${next}.` : 'Top tier reached.'}</p>
        </div>
    );
};

const DetailSheet: React.FC<{ detail: Detail; onClose: () => void; onPickYear?: (id: string) => void }> = ({ detail, onClose, onPickYear }) => {
    const { park, gear, site, canteen, event, year, yearOption, campsite } = detail;
    let title = '';
    let text = '';
    if (park) {
        const card = PARK_BY_ID[park];
        title = card.name;
        text = `${card.points} points · ${card.states.join(', ')}`;
        if (card.any) text += ` · plus any ${card.any} tokens`;
        if (card.instant) text += `. Instant Action, after visiting: ${nfActionText(card.instant)}`;
    }
    if (campsite) {
        title = campsite.name;
        text = nfActionText(campsite.action);
        if (campsite.tile) {
            const sides = CAMPSITE_BY_ID[campsite.tile].sides;
            const other = sides.find(sd => sd.action !== campsite.action && JSON.stringify(sd.action) !== JSON.stringify(campsite.action));
            if (other) text += ` In Seasons ${other.seasons.join(' and ')} it flips to: ${nfActionText(other.action)}`;
        } else {
            text += ' The same every Season.';
        }
    }
    if (gear) { title = GEAR_BY_ID[gear].name; text = gearText(GEAR_BY_ID[gear]); }
    if (site) { title = SITES[site].name; text = SITES[site].text; }
    if (canteen) { title = 'Canteen'; text = CANTEEN_TEXT[CANTEEN_BY_ID[canteen.id].effect]; }
    if (event) { title = event.name; text = event.text; }
    if (year) { title = YEAR_BY_ID[year.id].name; text = yearDescription(YEAR_BY_ID[year.id]); }
    if (yearOption) { title = YEAR_BY_ID[yearOption].name; text = yearDescription(YEAR_BY_ID[yearOption]); }
    return (
        <div className="pk-sheet-backdrop" onClick={onClose}>
            <div className="pk-sheet center" onClick={(e) => e.stopPropagation()}>
                {park && <ParkCardView parkId={park} width={220} />}
                {gear && <GearCardView gearId={gear} width={220} />}
                {site && <SiteCard site={site} width={220} pawns={[]} />}
                {canteen && <CanteenCardView canteenId={canteen.id} filled={canteen.filled} width={220} />}
                {year && <YearCardView yearId={year.id} width={220} />}
                {yearOption && <YearCardView yearId={yearOption} width={220} />}
                <h4>{title}</h4>
                <p>{text}</p>
                {year && <YearProgress year={year} />}
                {campsite && <IconLine text={nfActionLine(campsite.action)} size={30} />}
                <div className="pk-actions">
                    <button type="button" className="pk-btn" onClick={onClose}>Close</button>
                    {yearOption && <button type="button" className="pk-btn primary" onClick={() => onPickYear(yearOption)}>Choose this card</button>}
                </div>
            </div>
        </div>
    );
};

const ScoreTable: React.FC<{ game: any; names: Record<string, string>; accents: Record<string, string>; icons: Record<string, number> }> = ({ game, names, accents, icons }) => {
    const order: string[] = [...game.order].sort((a, b) => game.scores[b].total - game.scores[a].total);
    const col = (label: React.ReactNode, get: (s: ScoreBreakdown) => number) => (
        <tr>
            <th>{label}</th>
            {order.map(id => <td key={id}>{get(game.scores[id])}</td>)}
        </tr>
    );
    const soloScore = game.solo ? game.scores[game.order[0]].total : null;
    return (
        <div className="pk-panel pk-final">
            <h3>
                {game.solo
                    ? soloRating(soloScore, !!game.nightfall && nfFull(game.nightfall.modules))
                    : `${game.winners.map((id: string) => names[id]).join(' & ')} ${game.winners.length > 1 ? 'share the win' : 'wins'}`}
            </h3>
            <table>
                <thead>
                    <tr>
                        <th />
                        {order.map(id => <th key={id}><Pawn accent={accents[id]} icon={icons[id]} size={18} /><span>{names[id]}</span></th>)}
                    </tr>
                </thead>
                <tbody>
                    {col(<span className="pk-rowhead"><Icon id="park_glyph" size={18} />Parks</span>, s => s.parks)}
                    {col(<span className="pk-rowhead"><Icon id="photo" size={18} />Photos</span>, s => s.photos)}
                    {col(<span className="pk-rowhead"><Icon id="year_glyph" size={18} />Year</span>, s => s.year)}
                    {col(<span className="pk-rowhead"><Icon id="marker" size={18} />First</span>, s => s.marker)}
                    {col(<b>Total</b>, s => s.total)}
                    {col('Parks visited', s => s.parksVisited)}
                </tbody>
            </table>
        </div>
    );
};

const YearPick: React.FC<{ me: any; onDetail: (d: Detail) => void }> = ({ me, onDetail }) => {
    const [ref, w] = useCardWidth(2, 12, 170);
    return (
        <div className="pk-panel">
            <h3 className="pk-title">Choose your Year card</h3>
            <p className="pk-sub">Your secret goal for the whole game. Only you can see it.</p>
            <div className="pk-row" ref={ref}>
                {me.yearOptions.map((id: string) => (
                    <div className="pk-labelled" key={id}>
                        <YearCardView yearId={id} width={w} onClick={() => onDetail({ yearOption: id })} />
                        <small>{YEAR_BY_ID[id].text}</small>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

const Market: React.FC<{ game: any; onDetail: (d: Detail) => void; me: any; myId: string }> = ({ game, onDetail }) => {
    const [ref, w] = useCardWidth(3, 8, 170);
    return (
        <div className="pk-panel pk-divided">
            <div ref={ref} className="pk-grid3" style={{ gridTemplateColumns: `repeat(3, ${w}px)` }}>
                {game.parksBoard.map((id: string | null, i: number) => id
                    ? <ParkCardView key={id} parkId={id} width={w} bonus={game.parkBonus[i]} onClick={() => onDetail({ park: id })} />
                    : <EmptySlot key={i} width={w} label="Closed" />)}
            </div>
            <div className="pk-grid3" style={{ gridTemplateColumns: `repeat(3, ${w}px)` }}>
                {game.gearBoard.map((id: string | null, i: number) => id
                    ? <GearCardView key={`${id}-${i}`} gearId={id} width={w} bonus={gearBonusAt(game, i)} onClick={() => onDetail({ gear: id })} />
                    : <EmptySlot key={i} width={w} ratio={GEAR_RATIO} label={game.solo ? `${i + 1} Sun` : 'Empty'} />)}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// New Season
// ---------------------------------------------------------------------------

const SEASON_PARTICLES = 32;
const BACKDROP_PARTICLES = 10;
const BACKDROP_SLOWDOWN = 4;
const SEASON_REVEAL_MS = 3200;
// these three match $deal-wait, $deal-step and $deal-time in parks.scss
const TRAIL_DEAL_WAIT_MS = 250;
const TRAIL_DEAL_STEP_MS = 130;
const TRAIL_DEAL_TIME_MS = 400;

const Weather: React.FC<{ theme: SeasonTheme; count: number; slow?: number }> = ({ theme, count, slow = 1 }) => (
    <>
        {Array.from({ length: count }, (_, i) => (
            <span
                key={i}
                className={`p ${theme.particle} ${theme.motion}`}
                style={{
                    // spread evenly but unevenly timed, and stable across re-renders
                    '--x': `${(i * 37) % 100}%`,
                    '--y': `${(i * 61) % 100}%`,
                    '--s': 0.6 + ((i * 7) % 5) / 5,
                    '--t': `${(2.4 + ((i * 3) % 7) * 0.45) * slow}s`,
                    '--d': `${-((i * 0.73) % 5) * slow}s`,
                    '--c': theme.colors[i % theme.colors.length]
                } as React.CSSProperties}
            />
        ))}
    </>
);

/** The Season's sky behind the page for as long as it lasts, with a little of its weather passing slowly through. */
const SeasonBackdrop: React.FC<{ season: string }> = ({ season }) => {
    const theme = SEASON_THEMES[season];
    return (
        <div className="pk-season-bg" aria-hidden="true">
            <div className="sky" style={{ background: theme.sky }} />
            <div className="weather"><Weather theme={theme} count={BACKDROP_PARTICLES} slow={BACKDROP_SLOWDOWN} /></div>
        </div>
    );
};

/** The Season's weather fills the screen, then its card lands on top. Tap to skip. */
const SeasonIntro: React.FC<{ game: any; leaving: boolean; onSkip: () => void }> = ({ game, leaving, onSkip }) => {
    const season = SEASON_BY_ID[game.activeSeason];
    const theme = SEASON_THEMES[game.activeSeason];
    return (
        <div className={['pk-season-intro', leaving ? 'leaving' : ''].join(' ')} style={{ background: theme.sky }} onClick={onSkip}>
            <Weather theme={theme} count={SEASON_PARTICLES} />
            <div className="pk-season-reveal">
                <small>Season {game.season} of {game.seasonsTotal}</small>
                <strong>{season.name}</strong>
                <IconLine text={seasonEffectLine(season)} size={30} />
                <span>{season.text}</span>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Turn order and Journal
// ---------------------------------------------------------------------------

const TurnOrder: React.FC<{ game: any; names: Record<string, string>; accents: Record<string, string>; icons: Record<string, number> }> = ({ game, names, accents, icons }) => (
    <div className="pk-order">
        {game.order.map((id: string) => {
            const on = game.phase === Phase.Play && game.waitingOn === id;
            return (
                <span key={id} className={['pk-order-seat', on ? 'on' : ''].join(' ')} style={on ? { borderColor: accents[id] } : undefined}>
                    <Pawn accent={accents[id]} icon={icons[id]} size={22} />
                    <span>{names[id]}</span>
                </span>
            );
        })}
    </div>
);

const LOG_CARD_W = 38;
const LOG_GEAR_W = 48;

const LogItemView: React.FC<{ item: LogItem; onDetail: (d: Detail) => void }> = ({ item, onDetail }) => {
    switch (item.kind) {
        case 'bag': return <CoinRun bag={item.bag} size={20} />;
        case 'icon': return <Icon id={item.id} size={20} />;
        case 'area': return <span className={`pk-log-area ${item.area.toLowerCase()}`} title={AREA_LABEL[item.area]}><Icon id={AREA_ICON[item.area]} size={26} /></span>;
        case 'site': return <SiteCard site={item.site} width={LOG_CARD_W} pawns={[]} onClick={() => onDetail({ site: item.site })} />;
        case 'park': return <ParkCardView parkId={item.id} width={LOG_CARD_W} onClick={() => onDetail({ park: item.id })} />;
        case 'gear': return <GearCardView gearId={item.id} width={LOG_GEAR_W} onClick={() => onDetail({ gear: item.id })} />;
        case 'canteen': return <CanteenCardView canteenId={item.id} filled={item.filled} width={LOG_CARD_W} onClick={() => onDetail({ canteen: item })} />;
        case 'season': {
            const season = SEASON_BY_ID[item.id];
            return <><strong>{season.name}</strong><IconLine text={seasonEffectLine(season)} size={16} /></>;
        }
        case 'campsite': {
            const action = item.spot === 'BOARD' ? CAMPSITE_BOARD_ACTION : campsideFor(CAMPSITE_BY_ID[item.tile!], item.season).action;
            const name = item.spot === 'BOARD' ? CAMP_BOARD_NAME : CAMPSITE_BY_ID[item.tile!].name;
            return (
                <button type="button" className="pk-log-event" title={name} onClick={() => onDetail({ campsite: { name, action, tile: item.tile || undefined } })}>
                    <IconLine text={nfActionLine(action)} size={20} />
                </button>
            );
        }
        case 'event': {
            const event = { name: EVENT_BY_ID[item.id].name, text: EVENT_OP_TEXT[item.op] };
            return (
                <button type="button" className="pk-log-event" title={event.name} onClick={() => onDetail({ event })}>
                    <CoinRun bag={{ [item.token]: 3 }} size={20} />
                    <Icon id="bolt" size={20} />
                </button>
            );
        }
    }
};

const LogResultView: React.FC<{ result: LogResult; onDetail: (d: Detail) => void }> = ({ result, onDetail }) => (
    <div className={['pk-log-result', result.bonus ? 'bonus' : ''].join(' ')}>
        {result.word && <span className="word">{result.word}</span>}
        {result.items.map((item, i) => <LogItemView key={i} item={item} onDetail={onDetail} />)}
    </div>
);

/** Newest first. A row reads: player, where they went, then what came of it, with any bonuses last. */
const Journal: React.FC<{ game: any; accents: Record<string, string>; icons: Record<string, number>; onDetail: (d: Detail) => void }> = ({ game, accents, icons, onDetail }) => (
    <div className="pk-log">
        {[...game.log].reverse().map((e: LogEntry) => {
            const results = e.results || [];
            return (
                <div key={e.moveId} className={['pk-log-row', e.playerId ? '' : 'sys'].join(' ')} title={e.text}>
                    {e.playerId && (
                        <div className="pk-log-head">
                            <Pawn accent={accents[e.playerId]} icon={icons[e.playerId]} ranger={e.playerId === 'RANGER'} size={22} />
                            {(e.dest || []).map((item, i) => <LogItemView key={i} item={item} onDetail={onDetail} />)}
                        </div>
                    )}
                    <div className="pk-log-results">
                        {[...results.filter(r => !r.bonus), ...results.filter(r => r.bonus)].map((result, i) => (
                            <LogResultView key={i} result={result} onDetail={onDetail} />
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface MainState {
    hiker: number | null;
    dest: number | Area | null;
    detail: Detail | null;
    sheetHidden: boolean;
    promptKey: string;
    seasonIntro: SeasonIntroStage;
}

export class ParksMainPage extends React.Component<ParksProps, MainState> {
    public state: MainState = { hiker: null, dest: null, detail: null, sheetHidden: false, promptKey: '', seasonIntro: null };
    private introTimer: ReturnType<typeof setTimeout> | null = null;

    public componentDidMount() {
        // a brand new game opens with its first Season too
        const game = this.props.game;
        if (game && game.log.length <= 1) this.startSeasonIntro();
    }

    public componentDidUpdate(prev: ParksProps) {
        const game = this.props.game;
        if (!game) return;
        const fresh = prev.game ? game.season !== prev.game.season || game.activeSeason !== prev.game.activeSeason : game.log.length <= 1;
        if (fresh) this.startSeasonIntro();
    }

    public componentWillUnmount() { this.clearIntroTimer(); }

    private clearIntroTimer() {
        if (this.introTimer) clearTimeout(this.introTimer);
        this.introTimer = null;
    }

    private startSeasonIntro() {
        this.clearIntroTimer();
        this.setState({ seasonIntro: 'reveal' });
        this.introTimer = setTimeout(this.dealTrail, SEASON_REVEAL_MS);
    }

    private dealTrail = () => {
        this.clearIntroTimer();
        this.setState({ seasonIntro: 'deal' });
        const cards = this.props.game.trail.length + 2;
        this.introTimer = setTimeout(() => this.setState({ seasonIntro: null }), TRAIL_DEAL_WAIT_MS + cards * TRAIL_DEAL_STEP_MS + TRAIL_DEAL_TIME_MS);
    };

    private renderSeasonIntro() {
        const stage = this.state.seasonIntro;
        if (!stage) return null;
        return <SeasonIntro game={this.props.game} leaving={stage === 'deal'} onSkip={this.dealTrail} />;
    }

    private mp(): any { return this.props.MP; }
    private respond = (answer: any) => { this.setState({ sheetHidden: false }); this.mp().respond(answer); };
    private showDetail = (detail: Detail) => this.setState({ detail });
    private pickYear = (id: string) => {
        this.setState({ detail: null });
        this.mp().pickYear(id);
    };
    private hideSheet = () => this.setState({ sheetHidden: true });

    private defaultHiker(moves: MoveOptions | null): number | null {
        if (!moves) return null;
        const options = moves.hikers.map((h, i) => ({ h, i })).filter(({ h }) => h.pos !== END);
        if (options.length === 0) return null;
        // Rear Hiker first: it has the most choices, and usually moves next.
        return options.reduce((a, b) => (b.h.pos < a.h.pos ? b : a)).i;
    }

    private currentHiker(): number | null {
        const moves: MoveOptions | null = this.props.game.moves;
        if (!moves) return null;
        const h = this.state.hiker;
        if (h !== null && moves.hikers[h] && moves.hikers[h].pos !== END) return h;
        return this.defaultHiker(moves);
    }

    private go = () => {
        const { dest } = this.state;
        const hiker = this.currentHiker();
        if (dest === null || hiker === null) return;
        this.setState({ dest: null, hiker: null, sheetHidden: false });
        if (typeof dest === 'number') this.mp().moveToSite(hiker, dest);
        else this.mp().moveToEnd(hiker, dest);
    };

    private renderSheet(me: any) {
        const game = this.props.game;
        const prompt = game.prompt;
        if (!prompt) return null;
        if (this.state.sheetHidden) return null;
        const key = `${prompt.kind}-${game.log.length ? game.log[game.log.length - 1].moveId : 0}`;
        const props = { game, me, respond: this.respond, onHide: this.hideSheet, key };
        switch (prompt.kind) {
            case 'CANTEEN': return <CanteenSheet {...props} />;
            case 'SITE_GAIN': return <SiteGainSheet {...props} />;
            case 'VISTA': return <VistaSheet {...props} />;
            case 'LOOKOUT': return <LookoutSheet {...props} />;
            case 'CANTEEN_CHOICE': return <CanteenChoiceSheet {...props} />;
            case 'RIVER': return <RiverSheet {...props} />;
            case 'PAY': return <PaySheet {...props} />;
            case 'EXCHANGE': return <ExchangeSheet {...props} />;
            case 'RESERVE': return <ReserveSheet {...props} />;
            case 'VISIT': return <VisitSheet {...props} />;
            case 'BUY': return <BuySheet {...props} />;
            case 'DISCARD': return <DiscardSheet {...props} />;
            case 'CAMP': return <CampSheet {...props} />;
            case 'NF_PAY': return <NfPaySheet {...props} />;
            case 'NF_SWAP': return <NfSwapSheet {...props} />;
            case 'NF_GEAR_PICK': return <NfGearPickSheet {...props} />;
            case 'NF_YEAR_RETURN': return <NfYearReturnSheet {...props} />;
            case 'RANGER_CAMP': return <RangerCampSheet {...props} />;
            case 'SHUTTER': return <ShutterSheet {...props} />;
            case 'LAKE': return <LakeSheet {...props} />;
            case 'PARKWAY': return <ParkwaySheet {...props} />;
            case 'SUMMIT': return <SummitSheet {...props} />;
        }
        return null;
    }

    private renderActionBar(me: any) {
        const p = this.props;
        const game = p.game;
        const { names } = { names: p.playerNames };
        if (game.prompt && this.state.sheetHidden) {
            return (
                <div className="pk-actionbar">
                    <span className="msg"><b>{PROMPT_TITLE[game.prompt.kind]}</b> is waiting on you</span>
                    <button type="button" className="pk-btn primary" onClick={() => this.setState({ sheetHidden: false })}>Decide</button>
                </div>
            );
        }
        if (!game.isTurn) {
            if (game.prompt) return null;
            const who = game.waitingOn;
            return <div className="pk-actionbar quiet"><span className="msg"><Pawn accent={p.playerAccents[who]} icon={p.playerIcons[who]} size={20} /> Waiting for {names[who]}</span></div>;
        }
        const moves: MoveOptions = game.moves;
        const hiker = this.currentHiker();
        const dest = this.state.dest;
        // rear Hiker first, so the picker reads along the Trail
        const activeHikers = moves.hikers.map((h, i) => ({ h, i })).filter(({ h }) => h.pos !== END).sort((a, b) => a.h.pos - b.h.pos);
        const distinct = activeHikers.length === 2 && activeHikers[0].h.pos !== activeHikers[1].h.pos;
        const tentOk = hiker !== null && moves.hikers[hiker].tent;
        const info = typeof dest === 'number' && hiker !== null ? moves.hikers[hiker].sites[dest] : null;
        const area = dest && typeof dest !== 'number' ? moves.areas[dest] : null;
        let hint: React.ReactNode = moves.forcedEnd && dest === null ? 'Last on the Trail: head to Trail End.' : null;
        if (info && info.campfire) hint = <small>uses your Campfire</small>;
        if (area && !area.possible) hint = <small>nothing to do there yet</small>;
        return (
            <div className="pk-actionbar">
                <div className="pk-actionrow">
                    {distinct && (
                        <div className="pk-hikerpick">
                            {activeHikers.map(({ h, i }) => {
                                const site: SiteId | null = h.pos === 0 ? null : game.trail[h.pos - 1];
                                const name = site ? SITES[site].name : 'Start';
                                return (
                                    <button type="button" key={i} className={hiker === i ? 'on' : ''} aria-label={name} title={name} onClick={() => this.setState({ hiker: i, dest: null })}>
                                        <SiteCard site={site} width={LOG_CARD_W} pawns={[]} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <span className="msg">{hint}</span>
                    {tentOk && dest === null && (
                        <button type="button" className="pk-btn" onClick={() => this.mp().useTent(hiker)}>Camp here</button>
                    )}
                    <button type="button" className="pk-btn primary" disabled={dest === null} onClick={this.go}>Go</button>
                </div>
            </div>
        );
    }

    private renderSeason() {
        const game = this.props.game;
        const season = SEASON_BY_ID[game.activeSeason];
        return (
            <div className="pk-panel pk-season">
                <div className="pk-season-body">
                    <strong>{season.name}</strong>
                    <span>{season.text}</span>
                </div>
                <IconLine text={seasonEffectLine(season)} size={20} />
            </div>
        );
    }

    private renderArena() {
        const p = this.props;
        const game = p.game;
        const myId = p.MP.clientId;
        const me = game.players[myId];
        if (!me) return <div className="pk-panel">You are watching this game.</div>;

        if (game.phase === Phase.Over) {
            return (
                <div className="pk-arena">
                    <ScoreTable game={game} names={p.playerNames} accents={p.playerAccents} icons={p.playerIcons} />
                    {p.isHost && <button type="button" className="pk-btn primary" onClick={() => this.mp().restartGame()}>Play again</button>}
                    <div className="pk-panel"><Journal game={game} accents={p.playerAccents} icons={p.playerIcons} onDetail={this.showDetail} /></div>
                    {this.state.detail && <DetailSheet detail={this.state.detail} onClose={() => this.setState({ detail: null })} />}
                </div>
            );
        }

        const pick = (d: number | Area) => this.setState({ dest: this.state.dest === d ? null : d });
        const trailProps: TrailProps = {
            game, accents: p.playerAccents, icons: p.playerIcons, moves: game.moves, hiker: this.currentHiker(),
            dest: this.state.dest, myId, onPick: pick, intro: this.state.seasonIntro
        };
        const awaitingYear = game.phase === Phase.Year;
        return (
            <div className="pk-arena">
                <SeasonBackdrop season={game.activeSeason} />
                {this.renderSeason()}
                {awaitingYear && (me.year
                    ? <div className="pk-panel"><p className="pk-sub">Waiting for the others to choose their Year cards.</p></div>
                    : <YearPick me={me} onDetail={this.showDetail} />)}
                {game.solo && <SoloPanel game={game} />}
                <div className="pk-panel"><PlayerKit game={game} player={me} id={myId} onDetail={this.showDetail} /></div>
                <div className="pk-panel pk-divided pk-trail-panel">
                    <Trail {...trailProps} />
                    {!awaitingYear && this.renderActionBar(me)}
                </div>
                {game.nightfall && game.nightfall.modules.campsites && <CampsitePanel game={game} onDetail={this.showDetail} />}
                <Market game={game} onDetail={this.showDetail} me={me} myId={myId} />
                <div className="pk-panel pk-divided">
                    <TurnOrder game={game} names={p.playerNames} accents={p.playerAccents} icons={p.playerIcons} />
                    <Journal game={game} accents={p.playerAccents} icons={p.playerIcons} onDetail={this.showDetail} />
                </div>
                {this.renderSheet(me)}
                {this.renderSeasonIntro()}
                {this.state.detail && <DetailSheet detail={this.state.detail} onClose={() => this.setState({ detail: null })} onPickYear={this.pickYear} />}
            </div>
        );
    }

    private renderTableaus() {
        const p = this.props;
        const game = p.game;
        const order: string[] = game.order;
        // you first, then the others in turn order from your seat; a spectator just sees turn order
        const seat = Math.max(0, order.indexOf(p.MP.clientId));
        const seated = [...order.slice(seat), ...order.slice(0, seat)];
        return (
            <div className="pk-arena">
                {game.phase !== Phase.Over && <SeasonBackdrop season={game.activeSeason} />}
                {seated.map((id) => (
                    <Tableau
                        key={id} game={game} p={game.players[id]} id={id} name={p.playerNames[id]}
                        accent={p.playerAccents[id]} icon={p.playerIcons[id]} onDetail={this.showDetail}
                    />
                ))}
                {this.renderSeasonIntro()}
                {this.state.detail && <DetailSheet detail={this.state.detail} onClose={() => this.setState({ detail: null })} />}
            </div>
        );
    }

    private topBar() {
        const p = this.props;
        const game = p.game;
        const me = game.players[p.MP.clientId];
        return (
            <span className="pk-topbar">
                <span>Season {game.season}/{game.seasonsTotal}</span>
                {me && <><span className="sep">|</span><b>{game.phase === Phase.Over ? game.scores[p.MP.clientId].total : me.score}</b><span>pts</span></>}
            </span>
        );
    }

    public render() {
        const p = this.props;
        const mp = p.MP;
        const game = p.game;
        if (!game) return null;
        const me = game.players[mp.clientId];
        const needsMe = game.isTurn || !!game.prompt || (game.phase === Phase.Year && me && !me.year);

        const links: any = {
            'home': { 'icon': 'compass', 'label': 'Trail', 'view': this.renderArena() },
            'tableau': { 'icon': 'users', 'label': 'Tableau', 'view': this.renderTableaus() },
            'rules': { 'icon': 'question-circle', 'label': 'Rules', 'view': <>{this.renderSeasonIntro()}<ParksRulesView inGame nightfall={game.nightfall ? game.nightfall.modules : undefined} wildlife={game.wildlife ? game.wildlife.modules : undefined} /></> }
        };
        if (p.isHost) {
            links['settings'] = {
                'icon': 'cogs', 'label': 'Settings',
                'view': (
                    <div className="pk-settings">
                        <button type="button" className="pk-btn" onClick={() => this.mp().restartGame()}>Restart game</button>
                        <button type="button" className="pk-btn ghost" onClick={() => this.mp().backToLobby()}>Back to lobby</button>
                    </div>
                )
            };
        }

        return mp.getPluginView('gameshell', 'HostShell-Main', {
            'links': links,
            'gameName': 'Parks',
            'topBarContent': this.topBar(),
            'roomClassName': needsMe ? 'attention-bg' : ''
        });
    }
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

/** An expansion in the lobby: all or nothing in one tap, or its parts one by one. */
function ExpansionPicker<K extends string>(props: {
    title: string; name: string; parts: { id: K; name: string; text: string }[]; on: Record<K, boolean>;
    any: boolean; full: boolean; onSet: (v: boolean | Partial<Record<K, boolean>>) => void;
}) {
    const { title, name, parts, on, any, full, onSet } = props;
    return (
        <div className="pk-lobby-opt">
            <div className="pk-label">{title}</div>
            <div className="pk-opt-buttons">
                <button type="button" className={['pk-btn small', !any ? 'primary' : ''].join(' ')} onClick={() => onSet(false)}>Off</button>
                <button type="button" className={['pk-btn small', full ? 'primary' : ''].join(' ')} onClick={() => onSet(true)}>All of {name}</button>
            </div>
            <div className="pk-nf-parts">
                {parts.map(m => (
                    <button key={m.id} type="button" role="switch" aria-checked={on[m.id]} className={on[m.id] ? 'on' : ''} onClick={() => onSet({ ...on, [m.id]: !on[m.id] })}>
                        <span className="pk-nf-check">{on[m.id] ? '✓' : ''}</span>
                        <span><b>{m.name}</b><small>{m.text}</small></span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export class ParksHostLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp: any = this.props.MP;
        const playerCount = mp.playersCount() + 1;
        const firstGame = mp.getData ? mp.getData('parks_firstGame') === true : false;
        const nf = nfModulesOf(mp.getData ? mp.getData('parks_nightfall') : false);
        const wl = wlModulesOf(mp.getData ? mp.getData('parks_wildlife') : false);
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="pk-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <div className="pk-lobby-opt">
                            <div className="pk-label">Year card</div>
                            <div className="pk-opt-buttons">
                                <button type="button" className={['pk-btn small', !firstGame ? 'primary' : ''].join(' ')} onClick={() => mp.setFirstGame(false)}>Deal 2, keep 1</button>
                                <button type="button" className={['pk-btn small', firstGame ? 'primary' : ''].join(' ')} onClick={() => mp.setFirstGame(true)}>First game: deal 1</button>
                            </div>
                        </div>
                        <ExpansionPicker
                            title="Nightfall expansion" name="Nightfall" parts={NF_MODULES} on={nf}
                            any={nfAny(nf)} full={nfFull(nf)} onSet={(v: boolean | Partial<NfModules>) => mp.setNightfall(v)}
                        />
                        <ExpansionPicker
                            title="Wildlife expansion" name="Wildlife" parts={WL_MODULES} on={wl}
                            any={wlAny(wl)} full={wlFull(wl)} onSet={(v: boolean | Partial<WlModules>) => mp.setWildlife(v)}
                        />
                        {(playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS)
                            ? <p className="pk-warn">{playerCount} players connected. Parks needs {MIN_PLAYERS} to {MAX_PLAYERS}.</p>
                            : <p className="pk-sub">{playerCount === 1 ? 'Solo game against the Rangers.' : `${playerCount} players.`} Parks supports {MIN_PLAYERS}–{MAX_PLAYERS}.</p>}
                    </div>
                )
            },
            'clients': { 'icon': 'users', 'label': 'Players', 'view': mp.getPluginView('lobby', 'host-roommanagement') },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <ParksRulesView nightfall={nfAny(nf) ? nf : undefined} wildlife={wlAny(wl) ? wl : undefined} /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Parks', 'links': links });
    }
}

export class ParksClientLobby extends React.Component<ViewPropsInterface, {}> {
    public render() {
        const mp = this.props.MP;
        const links: any = {
            'home': {
                'icon': 'home', 'label': 'Lobby',
                'view': (
                    <div className="pk-lobby">
                        {mp.getPluginView('lobby', 'SetNameWithLobby')}
                        <p className="pk-sub">Waiting for the host to start.</p>
                    </div>
                )
            },
            'rules': { 'icon': 'book', 'label': 'Rules', 'view': <ParksRulesView /> }
        };
        return mp.getPluginView('gameshell', 'HostShell-Main', { 'gameName': 'Parks', 'links': links });
    }
}
