/**
 * CoupLastAction.tsx - Shows the last action taken
 */

import * as React from 'react';

import {
    addActions
} from '../CoupFunctions';

import {
    ViewPropsInterface
} from '../../../common/interfaces';

import {
    CoupActionInterface
} from '../CoupTypes';

export function CoupLastAction(
    props: ViewPropsInterface & { actions: CoupActionInterface[] }
) {
    const actions = props.actions;

    if (actions.length === 0) {
        return null;
    } else {
        const action = actions[actions.length - 1];
        const actionsEl = [];

        addActions(props.MP, action, actionsEl);

        return (
            <ul className='coup-actionslist coup-lastaction'>
                { actionsEl }
            </ul>
        );
    }
}

export default CoupLastAction;
