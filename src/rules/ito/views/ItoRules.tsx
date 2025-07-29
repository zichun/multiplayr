import * as React from 'react';

const ItoRuleComponent = class extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="ito-lobby">
                <h1>Ito - Cooperative Number Game</h1>
                <div className="ito-rules">
                    <p>Work together to sort your clues from lowest to highest numbers!</p>
                    <p>You have 3 rounds and lives equal to the number of players.</p>
                    <p>Lose a life for each incorrectly ordered pair.</p>
                </div>
            </div>
        );
    }
}

export const ItoGameRules = React.createElement(ItoRuleComponent, {});
export default ItoGameRules;
