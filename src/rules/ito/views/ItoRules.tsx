import * as React from 'react';

const ItoRuleComponent = class extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="ito-lobby">
                <h1>Ito - Cooperative Number Game</h1>
                <div className="ito-rules">
                    <p>Work together to sort your clues from lowest to highest numbers!</p>
                    <p>You have 3 rounds and lives that scales with the number of players.</p>
                    <p>Lose a life for each number locked in that is out of order.</p>
                    <p>You can communicate and change your input clues before locking in to add specificity.</p>
                    <p>Your clues should ideally be a noun, but can include qualifying adjectives, e.g. "Supermarket tuna rice ball on sale".</p>
                    <p>However, clues and communications should never mention, reference, or hint at, numerical values.</p>
                </div>
            </div>
        );
    }
}

export const ItoGameRules = React.createElement(ItoRuleComponent, {});
export default ItoGameRules;
