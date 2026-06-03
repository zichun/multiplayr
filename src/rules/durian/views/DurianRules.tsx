import * as React from 'react';

class DurianRulesComponent extends React.Component<{}, { slide: number }> {
    constructor(props: any) {
        super(props);
        this.state = { slide: 0 };
    }

    private nextSlide = () => {
        this.setState(prev => ({ slide: Math.min(prev.slide + 1, 3) }));
    };

    private prevSlide = () => {
        this.setState(prev => ({ slide: Math.max(prev.slide - 1, 0) }));
    };

    public render() {
        const slides = [
            (
                <div key="slide0" className="rules-slide">
                    <h3>🛒 Welcome to the Jungle Fruit Shop!</h3>
                    <p>You and your fellow players are clerks at a busy store managed by a short-tempered Gorilla boss.</p>
                    <p className="highlight">Your job is to accept fruit orders from customers without exceeding the actual fruit inventory in stock!</p>
                    <p>But there is a twist... <strong>You can see everyone&apos;s inventory card, but yours is hidden from you!</strong></p>
                </div>
            ),
            (
                <div key="slide1" className="rules-slide">
                    <h3>🍌 Taking Orders & Inventory Stands</h3>
                    <p>On your turn, you can draw a double-sided fruit card from the deck.</p>
                    <p>You see both sides (e.g. 2 Bananas vs. 1 Grape). Choose one side to place as an active order on the Order Board.</p>
                    <p className="highlight">Stand inventory cards are double-sided: BOTH sides of fruits are counted toward the total shop stock!</p>
                </div>
            ),
            (
                <div key="slide2" className="rules-slide">
                    <h3>⚖ Deck Constraints & Rarity Staircase</h3>
                    <p>Every card in the shop deck is special:</p>
                    <ul>
                        <li>One side ALWAYS has count = 1.</li>
                        <li>The other side ALWAYS has count = 2 or 3 of a DIFFERENT fruit.</li>
                    </ul>
                    <p>The fruits have a strict rarity staircase across all card sides: <strong>Banana (most common) &gt; Grape &gt; Strawberry &gt; Durian (most rare)</strong>.</p>
                </div>
            ),
            (
                <div key="slide3" className="rules-slide">
                    <h3>🔔 Calling the Manager (Ringing the Bell)</h3>
                    <p>If you believe the active orders on the board exceed the total fruits shown in everyone&apos;s stands combined, you can <strong>Ring the Bell!</strong> instead of drawing.</p>
                    <p className="highlight">Block: You cannot ring the bell on the first turn of a round when there are no orders yet!</p>
                    <ul>
                        <li>❌ <strong>If Orders Exceed Inventory</strong>: The player who placed the last order gets penalized!</li>
                        <li>✅ <strong>If Inventory is Sufficient</strong>: You get penalized for wasting the manager&apos;s time!</li>
                    </ul>
                    <p>Each penalty awards exactly <strong>1 penalty point (😡)</strong>. The game continues indefinitely without ending!</p>
                </div>
            )
        ];

        return (
            <div className="durian-rules-container">
                <h2>How to Play Durian</h2>
                <div className="rules-content">
                    {slides[this.state.slide]}
                </div>
                <div className="rules-nav">
                    <button onClick={this.prevSlide} disabled={this.state.slide === 0}>◀ Prev</button>
                    <span>{this.state.slide + 1} / {slides.length}</span>
                    <button onClick={this.nextSlide} disabled={this.state.slide === slides.length - 1}>Next ▶</button>
                </div>
            </div>
        );
    }
}

export const DurianGameRules = React.createElement(DurianRulesComponent, {});
export default DurianGameRules;
