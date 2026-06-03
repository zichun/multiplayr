import * as React from 'react';

const StartupsRuleComponent = class extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="startups-rules-overlay">
                <h1>Startups — Rules & How to Play</h1>
                
                <div className="rules-section">
                    <h2>Game Objective</h2>
                    <p>Compete to hold the <strong>majority of shares</strong> in 6 startup companies. Only the single biggest shareholder of each company earns money at the end!</p>
                </div>

                <div className="rules-section">
                    <h2>Startup Companies</h2>
                    <p>Each company has a different total number of cards in play:</p>
                    <ul className="companies-list">
                        <li>🦒 <strong>Giraffe Beer</strong>: 5 cards</li>
                        <li>🐶 <strong>Bowwow Games</strong>: 6 cards</li>
                        <li>🦩 <strong>Flamingo Soft</strong>: 7 cards</li>
                        <li>🐙 <strong>Octo Coffee</strong>: 8 cards</li>
                        <li>🦛 <strong>Hippo Powertech</strong>: 9 cards</li>
                        <li>🐘 <strong>Elephant Mars Travel</strong>: 10 cards</li>
                    </ul>
                    <p><em>Note: 5 cards are removed face-down at setup, so the exact distribution is always unknown!</em></p>
                </div>

                <div className="rules-section">
                    <h2>Turn Structure</h2>
                    <p>On your turn, you must take exactly <strong>one</strong> of these two Actions:</p>
                    <div className="action-card">
                        <h3>Action A: Draw from Deck</h3>
                        <p>1. <strong>Pay into the market:</strong> Place 1 coin on each card currently in the Market (except companies where you hold the Anti-Monopoly token).</p>
                        <p>2. Draw the top card of the deck (you now have 4 cards).</p>
                    </div>
                    <div className="action-card">
                        <h3>Action B: Take from the Market</h3>
                        <p>1. Choose any face-up card in the Market and take it (along with all coins on it) into your hand (you now have 4 cards).</p>
                        <p>2. <strong>Restriction:</strong> You cannot take a card of a company if you hold its Anti-Monopoly token.</p>
                    </div>
                    
                    <p style={{ marginTop: '15px' }}><strong>After drawing/taking, you must either:</strong></p>
                    <ul>
                        <li><strong>Invest:</strong> Play one card from hand face-up in front of you (your portfolio).</li>
                        <li><strong>Discard:</strong> Place one card from hand face-up into the Market (cannot discard same-company card if you took it from Market this turn).</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h2>Anti-Monopoly Token</h2>
                    <p>The player with the <strong>strictly most face-up cards</strong> of a company in their portfolio holds its Anti-Monopoly token.</p>
                    <ul>
                        <li>🚫 You <strong>cannot take</strong> that company&apos;s cards from the Market.</li>
                        <li>🛡️ You <strong>skip placing coins</strong> on that company&apos;s cards when drawing from the deck.</li>
                        <li>⚠️ If another player ties you, the token returns to the center.</li>
                    </ul>
                </div>

                <div className="rules-section">
                    <h2>Scoring</h2>
                    <p>When the deck runs out, the game ends immediately. Players reveal their hands and add them to their portfolios.</p>
                    <p>Companies are scored from smallest (5) to largest (10):</p>
                    <ul>
                        <li>🥇 The <strong>majority shareholder</strong> (strictly most cards) of a company gets paid by <strong>every player</strong> who holds <strong>at least 1 card</strong> of that company.</li>
                        <li>💰 Payer gives <strong>1 coin per card</strong> they hold of that company to the majority shareholder.</li>
                        <li>🔄 Payer pays using &quot;1&quot;-side coins. Majority shareholder flips them to &quot;3&quot;-side coins (worth 3 points).</li>
                        <li>🏦 If payer has no &quot;1&quot;-coins left, the bank pays the majority shareholder instead!</li>
                        <li>❌ If there is a <strong>tie for majority</strong>, no one pays and no one receives anything for that company.</li>
                    </ul>
                </div>
            </div>
        );
    }
}

export const StartupsGameRules = React.createElement(StartupsRuleComponent, {});
export default StartupsGameRules;
