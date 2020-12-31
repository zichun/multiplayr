import * as React from 'react';

import {
    MPType,
    ViewPropsInterface
} from '../../../common/interfaces';

import { DecryptoViewPropsInterface, DecryptoNotification } from '../DecryptoCommon';
import { DecryptoGameRule } from './DecryptoRules';

import { Notification } from '../../../client/components/Notification';
import Sound from 'react-sound';
import PassSound from '../sounds/pass.mp3';
import FailSound from '../sounds/fail.mp3';

export function WordListView(props: DecryptoViewPropsInterface) {
    return [
        <h1 className="notification">Team Words:</h1>,
        props.words.map(word => {
            return (<div style={{textAlign:'center'}}>{ word }</div>);
        }),
        <div style={{height: '1em'}} />
    ];
}

function DecryptoClientNotification(props: DecryptoViewPropsInterface) {
    if (!props.notifications || props.notifications.length === 0) {
        return;
    }

    const notifications = []
    const sounds = [];

    if (props.notifications.indexOf(DecryptoNotification.Miscommunication) !== -1) {
        notifications.push(<h1>Miscommunication!</h1>);
        sounds.push(<Sound
            url={ FailSound }
            playStatus="PLAYING" />);
    }

    if (props.notifications.indexOf(DecryptoNotification.Interception) !== -1) {
        notifications.push(<h1>Interception!</h1>);
        sounds.push(<Sound
            url={ PassSound }
            playStatus="PLAYING" />);
    }

    return (
        <Notification>
        { sounds }
        { notifications }
        </Notification>
    );
}

function ClientInputClues(props: DecryptoViewPropsInterface) {
    const clueSet = props.clueSet;
    const clientId = props.MP.clientId;
    if (clueSet.length === 0) {
        return (<div>
            { DecryptoClientNotification(props) }
            <h4>Waiting for all clues to be written...</h4>
        </div>);
    }

    console.log(props);

    const cluesInput = (clueSet.map((c, ind) => {
        return (
            <div style={{lineHeight:'25px'}}>
                Clue for { props.words[c-1] }: 
                <div>
                    <input style={{ width: '300px'}} type="text" id={clientId + '-clue-' + ind} />
                </div>
            </div>
        );
    }));

    function submitClues()
    {
        const mp = props.MP;
        let good = true;
        const clues = [0, 1, 2].map(clueInd => {
            const clue = (document.getElementById(mp.clientId + '-clue-' + clueInd) as any).value.trim();
            if (clue === '') {
                good = false;
            }
            return clue;
        });

        if (!good) {
            alert("Cannot submit empty clue");
            return;
        }

        if (confirm("Submit clues: " + clues)) {
            mp.submitClue(clues);
        }
    }

    const submitCluesBtn = (<button style={{float:'right'}} onClick={ submitClues } >Submit Clues</button>);
    return [
        DecryptoClientNotification(props),
        <h4>Please enter clues for your words. </h4>,
        <div style={{height: '1em'}} />,
        cluesInput,
        <div style={{height: '1em'}} />,
        submitCluesBtn
    ];
}

export function DecryptoClientInputClues(props: DecryptoViewPropsInterface) {
    return [WordListView(props),
            ClientInputClues(props)];
}
