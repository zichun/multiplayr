/**
 * ParksRulesView.tsx — the Rules tab: how a game runs, then a reference for every
 * icon a player meets on the Trail and on cards, with Nightfall and Wildlife in sub-tabs of their own.
 * Static, so it also works in the lobby.
 */

import * as React from 'react';
import {
    SITES, SiteId, TOKENS, TOKEN_NAME, CANTEEN_EFFECTS, CANTEEN_TEXT, GEAR_CARDS, gearText, SEASON_CARDS, soloRating,
    CAMPSITE_TILES, CAMPSITE_BOARD_ACTION, nfActionText, NfModules, NF_MODULES,
    WlModules, WL_MODULES, WL_GEAR_CARDS, WL_SEASON_CARDS, WL_SITES, WL_CANTEEN_EFFECTS, nfAny, wlAny
} from '../ParksData';
import { siteIconId, tokenIconId, seasonEffectLine, nfActionLine, gearEffectText } from '../ParksAssets';
import { Icon, IconLine } from './ParksViews';

const SITE_ORDER: SiteId[] = ['FOREST', 'MOUNTAIN', 'VALLEY', 'OCEAN', 'VISTA', 'WATERFALL', 'WILDLIFE', 'LODGE', 'LOOKOUT', 'RIVER'];

const BaseRules: React.FC = () => {
    const gearTypes = GEAR_CARDS.filter((g, i) => GEAR_CARDS.findIndex(x => x.type === g.type) === i);
    return (
        <div className="pk-rules">
            <h3>The goal</h3>
            <p>
                Spend four Seasons hiking the Trail, gathering tokens to visit Parks. Most points wins:
                visited Parks, Photos at 1 point each, your secret Year card, and 1 point for the First Hiker Marker.
                Ties go to whoever visited more Parks.
            </p>

            <h3>Your turn</h3>
            <p>
                Move one of your two Hikers forward to any Site, or all the way to Trail End. Take that Site’s reward.
                You can’t go to a Site whose action you can’t take. Weather tokens on a Site are yours first, and can pay for its action.
            </p>
            <p className="pk-rule-row">
                <Icon id="campfire" size={26} />
                <span>Someone already there? Put out your Campfire to share the Site. It relights when one of your Hikers reaches Trail End.</span>
            </p>

            <h3>Trail End</h3>
            <p className="pk-rule-row"><Icon id="reserve_glyph" size={26} /><span><b>Reserve</b> a Park for later. The first Hiker here each Season takes the First Hiker Marker and starts the next Season.</span></p>
            <p className="pk-rule-row"><Icon id="gear_glyph" size={26} /><span><b>Buy Gear</b> with Sunshine. The first Hiker (first two with 4–5 players) pays 1 less.</span></p>
            <p className="pk-rule-row"><Icon id="visit_glyph" size={26} /><span><b>Visit</b> a board or reserved Park by paying its coins. It scores at game end.</span></p>
            <p>When only one Hiker is left on the Trail, it must go straight to Trail End, and the Season ends.</p>

            <h3>Season end</h3>
            <p className="pk-rule-row">
                <Icon id="camera" size={26} />
                <span>The Camera holder may take a Photo for 1 token. Holding it also makes every other Photo cost 1 instead of 2.</span>
            </p>
            <p>Canteens empty, Hikers return to the start, and the next Trail gains one Advanced Site.</p>

            <h3>Tokens</h3>
            <div className="pk-rule-grid">
                {TOKENS.map(t => <span key={t}><Icon id={tokenIconId(t)} size={24} />{TOKEN_NAME[t]}</span>)}
            </div>
            <p>
                Wildlife stands in for any token when visiting a Park or taking a Photo, but never fills a Canteen or buys Gear.
                The brown square means any token. End your turn with at most 12 tokens.
            </p>

            <h3>Canteens</h3>
            <p className="pk-rule-row">
                <Icon id="canteen_full" size={26} />
                <span>When you gain Water on your turn you may pour it into an empty Canteen for its reward. It stays full until the Season ends.</span>
            </p>
            <ul>{CANTEEN_EFFECTS.map(e => <li key={e}>{CANTEEN_TEXT[e]}</li>)}</ul>

            <h3>Sites</h3>
            <div className="pk-rule-sites">
                {SITE_ORDER.map(id => (
                    <div key={id}>
                        <span className="pk-thumb"><Icon id={siteIconId(id)} size={44} /></span>
                        <span><b>{SITES[id].name}</b>{SITES[id].advanced ? ' (Advanced)' : ''}<small>{SITES[id].text}</small></span>
                    </div>
                ))}
            </div>

            <h3>Gear</h3>
            <ul>{gearTypes.map(g => <li key={g.type}><b>{g.name}.</b> {gearText(g).replace(/at the \w+|the \w+\./, (m) => m.includes('at') ? 'at its Site' : 'its Site.')}</li>)}</ul>

            <h3>Seasons</h3>
            <div className="pk-rule-seasons">
                {SEASON_CARDS.map(s => (
                    <div key={s.id}><IconLine text={seasonEffectLine(s)} size={18} /><span><b>{s.name}.</b> {s.text}.</span></div>
                ))}
            </div>

            <h3>Solo</h3>
            <p className="pk-rule-row">
                <Icon id="ranger" size={26} />
                <span>
                    Play one player to race two Rangers. After each of your turns the next Gear card is revealed and moves a Ranger
                    that many Sites. Rangers collect Weather: three of a kind fires the Event card. Reaching Trail End, they close a Park and may
                    take the Camera or the First Hiker Marker.
                </span>
            </p>
            <p>Ratings: 30+ {soloRating(30)}, 25+ {soloRating(25)}, 20+ {soloRating(20)}, below that {soloRating(0)}.</p>
        </div>
    );
};

const NightfallRules: React.FC<{ modules?: NfModules }> = ({ modules }) => (
    <div className="pk-rules">
        <h3>Nightfall expansion</h3>
        <p>The host can add all of it in the lobby, or any of its parts on their own.</p>
        {modules && <p>This game uses: <b>{NF_MODULES.filter(m => modules[m.id]).map(m => m.name).join(', ')}</b>.</p>}
        <p className="pk-rule-row">
            <Icon id={tokenIconId('WILDLIFE')} size={26} />
            <span><b>Starting Wildlife.</b> Four more Wildlife join the supply, and everyone starts with one.</span>
        </p>

        <h3>Tents and Campsites</h3>
        <p className="pk-rule-row">
            <Icon id="tent" size={26} />
            <span>
                Each Season Tents stand on the Site before Trail End and every other Site back (one more with 4–5 players).
                Land on one and either take the Site as usual, or carry its Tent to a free Campsite and take that action instead.
                Campers don’t take the Weather token, but Gear for that Site still works. Each Campsite takes one Tent a Season.
            </span>
        </p>
        <div className="pk-rule-camps">
            <div><IconLine text={nfActionLine(CAMPSITE_BOARD_ACTION)} size={18} /><span><b>Campsite board.</b> {nfActionText(CAMPSITE_BOARD_ACTION)} One Tent (two with 4–5 players), every Season.</span></div>
            {CAMPSITE_TILES.map(t => t.sides.map(sd => (
                <div key={`${t.id}-${sd.seasons.join('')}`}>
                    <IconLine text={nfActionLine(sd.action)} size={18} />
                    <span><b>{t.name}</b>, Seasons {sd.seasons.join(' and ')}{t.fivePlayer ? ', 5 players' : ''}. {nfActionText(sd.action)}</span>
                </div>
            )))}
        </div>
        <h3>Nightfall Parks</h3>
        <p className="pk-rule-row">
            <Icon id="bolt" size={26} />
            <span>
                Nightfall Parks may show an Instant Action right of a bolt: visit the Park first, then you may take it. Those icons never count
                toward Year cards. A brown square is paid with any tokens, and discounts never cut it.
            </span>
        </p>
        <h3>Year cards</h3>
        <p className="pk-rule-row">
            <Icon id="year_glyph" size={26} />
            <span>
                Nightfall Year cards replace the base deck. They score per step, without a cap. You can gain more during play and every one scores,
                but copies of the same card score once. With any part of Nightfall, Year cards always go back face down to the bottom of the deck,
                and Campsites or Parks that draw Year cards draw from whichever deck is in play.
            </span>
        </p>
        <h3>Solo</h3>
        <p>
            The Ranger further back packs up every Tent it lands on or passes. If it stops on a Site with both Weather and a Tent, you choose which it takes.
            With all of Nightfall, ratings: 35+ {soloRating(35, true)}, 30+ {soloRating(30, true)}, 25+ {soloRating(25, true)}, below that {soloRating(0, true)}.
        </p>
    </div>
);

const inPlay = (parts: { id: string; name: string }[], on: Record<string, boolean>): string =>
    parts.filter(m => on[m.id]).map(m => m.name).join(', ');

const WildlifeRules: React.FC<{ modules?: WlModules }> = ({ modules }) => {
    // one row per distinct card; copies are counted
    const kinds = WL_GEAR_CARDS.filter((g, i) => WL_GEAR_CARDS.findIndex(x => gearText(x) === gearText(g)) === i);
    const copies = (text: string) => WL_GEAR_CARDS.filter(x => gearText(x) === text).length;
    return (
        <div className="pk-rules">
            <h3>Wildlife expansion</h3>
            <p>More of everything: the host can add any of its parts in the lobby. Each one just joins its deck or pile.</p>
            {modules && <p>This game uses: <b>{inPlay(WL_MODULES, modules)}</b>.</p>}

            <h3>Gear</h3>
            <div className="pk-rule-camps">
                {kinds.map(g => (
                    <div key={g.id}>
                        <IconLine text={gearEffectText(g)} size={18} />
                        <span><b>{g.name}</b>{copies(gearText(g)) > 1 ? ` ×${copies(gearText(g))}` : ''}, {g.cost} Sunshine. {gearText(g)}</span>
                    </div>
                ))}
            </div>
            <p>Spending your Campfire means using it to share a Site, or a Tent’s stay. Field Guides work alongside other Gear: a Wildlife covers two of its symbol, every time.</p>

            <h3>Seasons</h3>
            <div className="pk-rule-camps">
                {WL_SEASON_CARDS.map(s => (
                    <div key={s.id}><IconLine text={seasonEffectLine(s)} size={18} /><span><b>{s.name}.</b> {s.text}.</span></div>
                ))}
            </div>
            <p>A Season’s tokens on Trail End or on Gear go back to the supply when the Season ends.</p>

            <h3>Sites</h3>
            <div className="pk-rule-sites">
                {WL_SITES.map(id => (
                    <div key={id}>
                        <span className="pk-thumb"><Icon id={siteIconId(id)} size={44} /></span>
                        <span><b>{SITES[id].name}</b> (Advanced)<small>{SITES[id].text}</small></span>
                    </div>
                ))}
            </div>
            <p>They join the Advanced Sites, so each Season’s new Site comes from all eight.</p>

            <h3>Canteens</h3>
            <ul>{WL_CANTEEN_EFFECTS.map(e => <li key={e}>{CANTEEN_TEXT[e]} (3 copies)</li>)}</ul>
        </div>
    );
};

type RulesTab = 'base' | 'nightfall' | 'wildlife';

/**
 * Base rules plus a sub-tab per expansion. The lobby always offers every tab; in a game
 * an expansion's tab only appears when some of it is being played, and is badged "on".
 */
export class ParksRulesView extends React.Component<{ inGame?: boolean; nightfall?: NfModules; wildlife?: WlModules }, { tab: RulesTab }> {
    public state = { tab: 'base' as RulesTab };

    public render() {
        const { inGame, nightfall, wildlife } = this.props;
        const nfOn = !!nightfall && nfAny(nightfall);
        const wlOn = !!wildlife && wlAny(wildlife);
        const shown: Record<RulesTab, boolean> = { base: true, nightfall: !inGame || nfOn, wildlife: !inGame || wlOn };
        const tab: RulesTab = shown[this.state.tab] ? this.state.tab : 'base';
        const button = (id: RulesTab, icon: string, label: string, on: boolean) => shown[id] && (
            <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => this.setState({ tab: id })}>
                <Icon id={icon} size={18} />{label}
                {on && <span className="pk-subtab-on">on</span>}
            </button>
        );
        return (
            <div className="pk-rules-tabs">
                {(shown.nightfall || shown.wildlife) && (
                    <div className="pk-subtabs" role="tablist">
                        {button('base', 'visit_glyph', 'Base game', false)}
                        {button('nightfall', 'tent', 'Nightfall', nfOn)}
                        {button('wildlife', tokenIconId('WILDLIFE'), 'Wildlife', wlOn)}
                    </div>
                )}
                {tab === 'base' && <BaseRules />}
                {tab === 'nightfall' && <NightfallRules modules={nightfall} />}
                {tab === 'wildlife' && <WildlifeRules modules={wildlife} />}
            </div>
        );
    }
}
