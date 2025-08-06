import * as React from 'react';

const CatchSketchRuleComponent = class extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="catchsketch-lobby">
                <h1>Catch Sketch</h1>
                <div className="catchsketch-rules">
                    <p>Catch Sketch is a fast-pace drawing game where players compete to draw a given word</p>
                    <p>Each round, there is a guesser, and the other players will draw a secret word</p>
                    <p>The first player to complete their drawing can claim either the first or second token, which determines their turn in the guess order</p>
                    <p>The next player to complete their drawing will claim the remaining token, and that ends the drawing phase. The remaining players will be randomly assigned in the queue</p>
                    <p>After the first token is taken, players have 30s to complete their drawings (10s in a 3-players game)</p>
                    <p>The guesser will attempt to guess the words by looking at the drawings based on the turn order</p>
                    <p>Points will be awarded to both the guesser and the drawer if the guesser is able to identify the secret word from their drawing</p>
                    <p>The first drawing is worth 3 points, the second is worth 2 points, and the remaining is worth 1 point</p>
                    <p>Drawings should not contain any text or numbers</p>
                </div>
            </div>
        );
    }
}

export const CatchSketchRule = React.createElement(CatchSketchRuleComponent, {});
export default CatchSketchRule;
