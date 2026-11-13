/**
 * CKRules.tsx — an icon-led rules reference for Critter Kitchen.
 */

import * as React from 'react';
import { ING_TYPES, ING_NAMES, LOCATIONS } from '../CKData';
import { Icon, ChefHead, CKCard } from './CKBits';

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
    <div className="ck-rule-step">
        <span className="ck-rule-n">{n}</span>
        <div><b>{title}</b><div className="ck-rule-body">{children}</div></div>
    </div>
);

export const CKRulesView: React.FC = () => (
    <div className="ck-rules">
        <h3>Critter Kitchen</h3>
        <p>It&rsquo;s Restaurant Week in Bistro Bay! Over <b>7 rounds</b> (3 days) send your chefs shopping, serve
            <b> challenge meals</b> at the end of days 1 and 2, then cook a <b>7-course meal</b> for the critic. Most
            <Icon id="star" size={14} /> wins.</p>

        <div className="ck-rule-chefs">
            {(['mouse', 'lizard', 'boar'] as const).map(c => (
                <div key={c} className="ck-rule-chef">
                    <ChefHead chefKey={c} accent="#ef7a54" size={40} />
                    <span><b>{c[0].toUpperCase() + c.slice(1)}</b><small>carries {c === 'mouse' ? 1 : c === 'lizard' ? 2 : 3}</small></span>
                </div>
            ))}
        </div>
        <p className="ck-muted">Smaller chefs are faster: every 1-carry chef picks before 2s, and 2s before 3s.</p>

        <h4>Each round</h4>
        <Step n={1} title="Start of round">Restock the stalls, the Soup Truck&rsquo;s bisque, a new challenge and a new zous-chef at the Chef Academy.</Step>
        <Step n={2} title="Plan (secretly)">Send each chef — and any zous-chef — to a <b>different</b> location. Lock in.</Step>
        <Step n={3} title="Shop">Locations resolve left → right. At each, chefs pick by queue: 1s, then 2s, then 3s.
            If several chefs share a queue they take turns, one item each, in <b>priority order</b>. Whoever wins a tie and makes the
            location&rsquo;s first pick moves to the <b>back</b> of the priority track.
            A chef who comes home empty-handed (or leaves early) gets a consolation <Icon id="soup" size={14} />.</Step>
        <Step n={4} title="Leftovers">Unpicked food rolls on to the Chef Academy, then to the Soup Truck. Unpicked rumors are lost.</Step>

        <h4>Locations</h4>
        <div className="ck-rule-locs">
            {LOCATIONS.map(l => (
                <span key={l.id} className="ck-rule-loc"><Icon id={`loc_${l.id}`} size={26} />{l.name}
                    <small>{l.id === 'soup' ? 'endless soup' : l.id === 'midnight' ? 'stocked on arrival' : l.id === 'academy' ? 'zous-chef + leftovers' : `${l.spaces} items · ${l.minPlayers}+ players`}</small>
                </span>
            ))}
        </div>

        <h4>Items</h4>
        <div className="ck-rule-items">
            {ING_TYPES.map(t => <span key={t} className="ck-rule-item"><Icon id={`ing_${t}`} size={28} />{ING_NAMES[t]}</span>)}
        </div>
        <p>Ingredients are worth <b>2–7</b>. A matching <Icon id="spice_bread" size={16} /> spice doubles one ingredient;
            <Icon id="spice_all" size={16} /> allspice fits anything. <Icon id="soup" size={16} /> Soup (1) and
            <Icon id="bisque" size={16} /> bisque (3) add quality to challenges and can stand in for a missing ingredient — never for the critic.
            <Icon id="rumor_q" size={16} /> Rumor tokens let you peek at one of the critic&rsquo;s secret rumors;
            <Icon id="rumor_wild" size={16} /> wilds go in any slot you don&rsquo;t know yet.</p>

        <h4>Challenge meals (after rounds 3 &amp; 6)</h4>
        <div className="ck-rule-card"><CKCard card={{ kind: 'challenge', id: 'melt', held: true }} width={110} />
            <p>Serve one meal per face-up challenge. Each needs at least one of every required ingredient (soup may substitute,
                but not for all of them). Add any number of matching ingredients and soup.
                Quality <b>6+</b> = 1<Icon id="star" size={12} />, <b>12+</b> = 2, <b>21+</b> = 4.
                The day&rsquo;s last challenge has its last requirement held. Served food returns to the bag.
                Then refrigerate: keep <b>5</b> ingredients + spices after day 1, <b>10</b> after day 2.</p>
        </div>

        <h4>The critic meal (after round 7)</h4>
        <p>One ingredient (+ one spice) per course, in order: {ING_TYPES.map(t => ING_NAMES[t]).join(' → ')}. Then score:</p>
        <ul>
            <li>Most soup left: 1<Icon id="star" size={12} /></li>
            <li>All 7 courses: 1<Icon id="star" size={12} /></li>
            <li>Best of each course: 1<Icon id="star" size={12} /> each</li>
            <li>All rumors (everyone scores them, known or not)</li>
            <li>Restaurateur stars</li>
            <li>Total meal quality on the score track: 1<Icon id="star" size={12} /> per 7 quality, +10 per lap of 70</li>
        </ul>
        <p className="ck-muted">This edition plays the base game for 2–5 players with the À La Cart critics, restaurateurs and the zous-chefs
            whose abilities need no extra choices. Carts, solo McDogald&rsquo;s and the 6–7 player mode are not included.</p>
    </div>
);
