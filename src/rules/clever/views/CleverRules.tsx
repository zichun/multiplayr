/**
 * CleverRules.tsx - Instructions and rules for Clever
 */

import * as React from 'react';

export class CleverGameRules extends React.Component<{}, {}> {
    render() {
        return (
            <div style={{
                padding: '30px',
                backgroundColor: '#1a202c',
                color: '#e2e8f0',
                lineHeight: '1.6',
                fontFamily: "'Outfit', sans-serif",
                maxWidth: '800px',
                margin: '20px auto',
                borderRadius: '16px',
                border: '4px solid #000000',
                boxShadow: '8px 8px 0px #000000',
                boxSizing: 'border-box'
            }}>
                <h2 style={{
                    fontSize: '2em',
                    fontWeight: 800,
                    color: '#f1c40f',
                    borderBottom: '4px solid #000',
                    paddingBottom: '8px',
                    marginBottom: '20px'
                }}>
                    🎲 Clever — Rules Reference
                </h2>

                <section style={{ marginBottom: '24px' }}>
                    <h3 style={{ color: '#3498db', fontWeight: 800 }}>Overview</h3>
                    <p>
                        A dice drafting roll-and-write game. On your turn as the <strong>Active Player</strong>, you roll all 6 dice up to 3 times. 
                        Each roll, you pick one die to place on your sheet and mark its value in the matching colored area. 
                        All remaining rolled dice with a value <strong>strictly lower</strong> than your choice go to the <strong>Silver Tray</strong> and are lost to you this turn.
                    </p>
                    <p>
                        After you finish your 3 picks (or run out of dice), all other players (<strong>Passive Players</strong>) simultaneously pick <strong>one die</strong> from the Silver Tray to mark on their own sheets.
                    </p>
                </section>

                <section style={{ marginBottom: '24px' }}>
                    <h3 style={{ color: '#3498db', fontWeight: 800 }}>Game Structure & Round Bonuses</h3>
                    <p>
                        The number of rounds in the game depends on the number of players:
                    </p>
                    <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                        <li><strong>1 Player (Solo) / 2 Players:</strong> 6 Rounds</li>
                        <li><strong>3 Players:</strong> 5 Rounds</li>
                        <li><strong>4 Players:</strong> 4 Rounds</li>
                    </ul>
                    <p>
                        At the start of Rounds 1 to 4, all players receive an automatic round-start bonus:
                    </p>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        marginTop: '12px',
                        border: '2px solid #4a5568',
                        background: '#2d3748'
                    }}>
                        <thead>
                            <tr style={{ background: '#000', color: '#f1c40f' }}>
                                <th style={{ padding: '8px', border: '1px solid #4a5568', textAlign: 'left' }}>Round</th>
                                <th style={{ padding: '8px', border: '1px solid #4a5568', textAlign: 'left' }}>Bonus Received (All Players)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #4a5568', fontWeight: 'bold' }}>Round 1</td>
                                <td style={{ padding: '8px', border: '1px solid #4a5568' }}>1 Reroll token 🔄</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #4a5568', fontWeight: 'bold' }}>Round 2</td>
                                <td style={{ padding: '8px', border: '1px solid #4a5568' }}>1 Extra Die (+1) token ➕</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #4a5568', fontWeight: 'bold' }}>Round 3</td>
                                <td style={{ padding: '8px', border: '1px solid #4a5568' }}>1 Reroll token 🔄</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #4a5568', fontWeight: 'bold' }}>Round 4</td>
                                <td style={{ padding: '8px', border: '1px solid #4a5568' }}>
                                    <strong>Choice Bonus:</strong> Choose either an <strong>✕</strong> (mark Yellow, Blue, or Green) OR a <strong>6</strong> (write in Orange or Purple)
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #4a5568', fontWeight: 'bold' }}>Rounds 5–6</td>
                                <td style={{ padding: '8px', border: '1px solid #4a5568', color: '#a0aec0' }}>No round-start bonuses</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section style={{ marginBottom: '24px' }}>
                    <h3 style={{ color: '#3498db', fontWeight: 800 }}>The Five Color Areas</h3>
                    <ul style={{ paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '12px' }}>
                            <strong style={{ color: '#f1c40f' }}>Yellow Grid:</strong> Choose and mark any box that matches the yellow die value. 
                            However, <strong>the same number cannot be selected/marked twice</strong> in your Yellow Grid over the course of the game! 
                            Pre-printed ✕ cells in the opposite diagonal are already crossed off for you. 
                            Completed columns yield star point bonuses (10, 14, 16, 20 pts), which is the only source of scoring for the Yellow area. 
                            Completed rows and diagonal yield bonuses.
                        </li>
                        <li style={{ marginBottom: '12px' }}>
                            <strong style={{ color: '#3498db' }}>Blue Area:</strong> When marking Blue, you <strong>must</strong> add the current face value of the White die to the Blue die sum. Mark the sum (2–12) anywhere in the grid. Points scale up based on the number of marks (up to 56 pts).
                        </li>
                        <li style={{ marginBottom: '12px' }}>
                            <strong style={{ color: '#2ecc71' }}>Green Path:</strong> Mark cells from left-to-right. Each cell has a minimum requirement (e.g., <code>≥1</code>, <code>≥2</code>, etc.). Your selected die value must meet or exceed this minimum. Star points scale progressively (up to 66 pts).
                        </li>
                        <li style={{ marginBottom: '12px' }}>
                            <strong style={{ color: '#e67e22' }}>Orange Path:</strong> Fill cells from left-to-right. No value restrictions. Cells showing <code>x2</code> or <code>x3</code> multiply the die value placed there (e.g., a 5 placed on a x2 space records 10). Sum of all numbers is scored.
                        </li>
                        <li style={{ marginBottom: '12px' }}>
                            <strong style={{ color: '#9b59b6' }}>Purple Path:</strong> Fill cells from left-to-right. Each number placed must be strictly greater than the previous cell (e.g. <code>2 &lt; 5 &lt; 6</code>). <strong>Exception:</strong> After writing a <code>6</code>, the sequence resets and you can write any number (1–6) next. Sum of all numbers is scored.
                        </li>
                    </ul>
                </section>

                <section style={{ marginBottom: '24px' }}>
                    <h3 style={{ color: '#3498db', fontWeight: 800 }}>Actions & Tokens</h3>
                    <p>
                        Actions are unlocked from various row or column completions and can be saved to be used at key strategic moments:
                    </p>
                    <ul style={{ paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '8px' }}>
                            <strong>Reroll:</strong> Active Player only. Spend to reroll all currently available dice in your roll pool.
                        </li>
                        <li style={{ marginBottom: '8px' }}>
                            <strong>Extra Die (+1):</strong> Spent at the end of a turn (active or passive). Pick any of the 6 dice in play and record its value. 
                            Each individual die color can only be chosen once per turn across all Extra Die actions by a single player.
                        </li>
                    </ul>
                </section>

                <section style={{ marginBottom: '24px' }}>
                    <h3 style={{ color: '#e53e3e', fontWeight: 800 }}>End-Game Scoring & Foxes</h3>
                    <p>
                        At the end of the game, players sum their scores from all five color areas.
                    </p>
                    <p>
                        <strong>Foxes 🦊:</strong> Each fox you unlock is worth points equal to your <strong>lowest-scoring color area</strong>. 
                        <em>Warning:</em> If any color area scores 0 points, ALL your foxes score 0 points!
                    </p>
                    <p>
                        <strong>Tie-breaker:</strong> Highest individual color area score wins. Still tied? Shared victory!
                    </p>
                </section>
            </div>
        );
    }
}
