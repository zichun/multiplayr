/**
 * CoupActionsHistory.tsx - Shows history of all actions taken
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

export function CoupActionsHistory(
    props: ViewPropsInterface & { actions: CoupActionInterface[] }
) {
    const actions = props.actions;
    const actionsEl = [];

    for (let i = actions.length - 1; i >= 0; i = i - 1) {
        addActions(props.MP, actions[i], actionsEl, i);
    }

    return (
        <div className='coup-actions-page'>
            <header>Actions history</header>
            <ul className='coup-actionslist'>
                { actionsEl }
            </ul>
        </div>
    );
}

export default CoupActionsHistory;
