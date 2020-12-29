/**
 * CoupClientCoins.tsx - Component for coins at the top bar
 */

import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import {
    CoupViewPropsInterface
} from '../CoupTypes';

export function CoupClientCoins(props: CoupViewPropsInterface) {
    return (
        <div className='coup-client-coin'>
            <FontAwesomeIcon icon="dollar-sign" />
            &nbsp;
            { props.coins }
        </div>
    );
}

export default CoupClientCoins;
