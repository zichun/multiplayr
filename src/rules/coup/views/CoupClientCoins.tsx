/**
 * CoupClientCoins.tsx - Component for coins at the top bar
 */

import * as React from 'react';
import * as FontAwesome from 'react-fontawesome';

import {
    CoupViewPropsInterface
} from '../CoupTypes';

export function CoupClientCoins(props: CoupViewPropsInterface) {
    return (
        <div className='coup-client-coin'>
            <FontAwesome name='usd' />
            &nbsp;
            { props.coins }
        </div>
    );
}

export default CoupClientCoins;
