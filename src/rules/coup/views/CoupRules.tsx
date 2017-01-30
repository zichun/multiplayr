import * as React from 'react';

const CoupRuleComponent = class extends React.Component<{}, {}> {
    public render() {
        return (
            <div className='coupRule'>
                <h1>Objective</h1>
                <p>
                    In <strong>Coup</strong>, you want to be the last player with a character card left in the game.
                </p>
                <h2>Set up</h2>
                <p>
                    Each player starts the game with 2 coinds and 2 character cards (which are unknown to other players). The 2 cards
                    are chosen from a deck of 15 character cards (comprising 3 copies of 5 different characters, each with a unique
                    set of abilities).
                </p>
                <h2>Characters</h2>
                <ul>
                    <li><strong>Duke</strong> - Take 3 coins from the treasury. Block someone from taking foreign aid</li>
                    <li><strong>Assassin</strong> - Pay 3 coins and try to assassinate another player's character</li>
                    <li><strong>Contessa</strong> - Block an assassination attempt against yourself</li>
                    <li><strong>Captain</strong> - Steal 2 coins from another player, or block someone from stealing coins from you.</li>
                    <li><strong>Ambassador</strong> - Draw 2 character cards from the deck, and choose which (if any) to exchange with your own. Block another player from stealing coins from you</li>
                </ul>
                <h2>Game Play</h2>
                <p>
                    On your turn, you can take any of the actions listed above (except Contessa), regardless what character cards you actually have. You can also choose to take one of three other actions:
                </p>
                <ul>
                    <li><strong>Income</strong> - Take 1 coin from the treasury</li>
                    <li><strong>Foreign aid</strong> - Take 2 coins from the treasury</li>
                    <li><strong>Coup</strong> - Pay 7 coins and launch a coup against another player, forcing that player to lose a character card. If you have 10 or more coins, you <strong>must</strong> take this action</li>
                </ul>
                <p>
                    When you take one of the character actions - whether actively on your turn or defensively in response to someone else's actions - that character's action automatically succeeds unless someone challenges you. In this case, if you can't reveal the appropriate character, you lose an influence, turning one of your characters face-up. Face-up characters cannot be used, and if both of your characters are face-up, you're out of the game.
                </p>
                <p>
                    If you have the character in question and choose to reveal it, the opponent loses a card, then you shuffle that character into the deck and draw a new one. Note that you can choose <strong>not</strong> to reveal the character card being challenged, and choose to lose a card instead.
                </p>
            </div>
        );
    }
}

export const CoupGameRule = React.createElement(CoupRuleComponent, {});
export default CoupGameRule;
