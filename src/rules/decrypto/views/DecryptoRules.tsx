import * as React from 'react';

const DecryptoRuleComponent = class extends React.Component<{}, {}> {
    public render() {
        return (
            <div className='decryptoRule'>
                <h1>Objective</h1>
                <p>
                    In <strong>Decrypto</strong>, blah blah blah
                </p>
            </div>
        );
    }
}

export const DecryptoGameRule = React.createElement(DecryptoRuleComponent, {});
export default DecryptoGameRule;
