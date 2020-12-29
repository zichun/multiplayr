/**
 * debugger.tsx
 */
import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './debugger.scss';

import {
    GameRuleInterface,
    MPType,
    ViewPropsInterface
} from '../../common/interfaces';

import {
    forEach
} from '../../common/utils';

interface DebuggerViewPropsInterface extends ViewPropsInterface {
    plugin: string,
    historyCount: number,
    historyPointer: number,
    serializedState: string
}

function reMapClient(
    previousState: any,
    mp: MPType
) {
    const clientsStore = JSON.parse(previousState[0]).clientsStore
    const playersRequired = Object.keys(clientsStore).length;
    let stateString = JSON.stringify(previousState);
    const newPlayers = [];

    mp.playersForEach((clientId) => {
        newPlayers.push(clientId);
    });

    if (newPlayers.length !== playersRequired) {
        throw (new Error('Players count mismatched'));
    }

    let count = 0;
    forEach(clientsStore, (clientId) => {
        stateString = stateString.replace(
            new RegExp(clientId.replace('.', '\\.'), 'g'),
            newPlayers[count]);
        count = count + 1;
    });

    return JSON.parse(stateString);
}

const DebuggerGameStatesLocalStorageName = 'debuggerGameStates';
/**
 * @class GameStates
 * A store for a history of game states. While game rules are designed to be stateless, the debugger
 * rule take an exception and store the history in memory. This is because if the gamestate history is
 * stored within the state of the game rule, then there will be a cyclic reference during serialization.
 */
class GameStates {
    private gameStates: string[];
    private bufferSize: number;
    private pointer: number;
    private historyInLocalStorage: boolean;
    private previousGameStates: any;
    private requiredPlayers: number;
    private MP: MPType;

    constructor(
        Size: number,
        HistoryInLocalStorage: boolean = false,
        MP: MPType
    ) {
        this.bufferSize = Size;
        this.gameStates = [];
        this.pointer = 0;
        this.historyInLocalStorage = HistoryInLocalStorage;
        this.MP = MP;

        this.previousGameStates = null;
        this.requiredPlayers = 0;

        if (HistoryInLocalStorage && sessionStorage.getItem(DebuggerGameStatesLocalStorageName)) {
            this.previousGameStates = JSON.parse(sessionStorage.getItem(DebuggerGameStatesLocalStorageName));
            this.requiredPlayers = Object.keys(JSON.parse(this.previousGameStates[this.previousGameStates.length - 1]).clientsStore).length;
        }
    }

    public count() {
        return this.gameStates.length;
    }

    public getPointer() {
        return this.pointer;
    }

    public top() {
        const count = this.count();
        if (count) {
            return this.gameStates[this.pointer];
        } else {
            return null;
        }
    }

    public clear() {
        this.gameStates = [];
    }

    public seekLeft() {
        if (this.pointer - 1 < 0) {
            return null;
        }
        this.pointer = this.pointer - 1;
        return this.gameStates[this.pointer];
    }

    public seekRight() {
        if (this.pointer + 1 >= this.count()) {
            return null;
        }
        this.pointer = this.pointer + 1;
        return this.gameStates[this.pointer];
    }

    public push(state: any) {

        let freshLoad = false;
        const cPlayers = Object.keys(JSON.parse(state).clientsStore).length

        if (this.count()) {
            const previousState = this.top();

            if (previousState === state) {
                // if the serialized state is the same, skip inserting this state.
                return;
            }

            if (this.pointer + 1 < this.count() &&
                this.gameStates[this.pointer + 1] === state) {
                // if the serialized state is the same as the next, skip inserting this state.
                this.pointer = this.pointer + 1;
                return;
            }

            const pPlayers = Object.keys(JSON.parse(previousState).clientsStore).length;

            if (pPlayers !== cPlayers) {
                // If the number of players differ, we start from scratch.
                this.clear();
            } else if (this.pointer !== this.count() - 1) {
                this.gameStates.splice(this.pointer + 1);
            }

        } else {
            freshLoad = true;
        }

        if (cPlayers === this.requiredPlayers && this.previousGameStates !== null) {
            this.gameStates = reMapClient(this.previousGameStates, this.MP);
            this.previousGameStates = null;
            this.pointer = this.gameStates.length - 1;
            if (this.gameStates.length) {
                this.MP.setState(this.gameStates[this.pointer], true);
            }
            sessionStorage.setItem(DebuggerGameStatesLocalStorageName, JSON.stringify(this.gameStates));
            return;
        }

        this.gameStates.push(state);

        if (this.count() > this.bufferSize) {
            this.gameStates.splice(0, 1);
        }

        this.pointer = this.count() - 1;

        if (this.historyInLocalStorage && !freshLoad) {
            sessionStorage.setItem(DebuggerGameStatesLocalStorageName, JSON.stringify(this.gameStates));
        }
    }
}

interface DebuggerRuleInterface extends GameRuleInterface {
    gameStates?: any
}

interface DebuggerRuleOptions {
    HistoryBufferSize?: number,
    HistoryInSessionStorage?: boolean
}

export function NewDebuggerRule(
    BaseGameRuleName: string,
    BaseGameRule: GameRuleInterface,
    Options: DebuggerRuleOptions
) : GameRuleInterface {

    const BaseGameRuleObject = {};
    BaseGameRuleObject[BaseGameRuleName] = BaseGameRule;
    const historyBufferSize = Options.HistoryBufferSize || 10;
    const historyInSessionStorage = Options.HistoryInSessionStorage || false;

    let gameStatesHistory = null;

    return {

        name: 'debugger',
        plugins: BaseGameRuleObject,

        globalData: {},
        playerData: {},

        onDataChange: (mp: MPType, rule: DebuggerRuleInterface) => {
            let pluginCount = 0;
            let debuggee = '';

            forEach(rule.plugins, (plugin) => {
            ++pluginCount;
                debuggee = plugin;
            });

            if (pluginCount !== 1) {
                throw (new Error('Debugger can only have one plugin as a child.'));
            }

            if (!gameStatesHistory) {
                gameStatesHistory = new GameStates(historyBufferSize, historyInSessionStorage, mp);
            }

            gameStatesHistory.push(mp.getState());

            mp.setViewProps(mp.hostId, 'plugin', debuggee);
            mp.setViewProps(mp.hostId, 'historyCount', gameStatesHistory.count());
            mp.setViewProps(mp.hostId, 'historyPointer', gameStatesHistory.getPointer());
            mp.setViewProps(mp.hostId, 'serializedState', gameStatesHistory.top());
            mp.setView(mp.hostId, 'debugger-host');

            mp.playersForEach((clientId) => {
                mp.setViewProps(clientId, 'plugin', debuggee);
                mp.setView(clientId, 'debugger-client');
            });

            return true;
        },

        methods: {
            'stepLeft': (mp: MPType, clientId: string) => {
                const state = gameStatesHistory.seekLeft();
                if (state) {
                    mp.setState(state, true);
                }
            },
            'stepRight': (mp: MPType, clientId: string) => {
                const state = gameStatesHistory.seekRight();
                if (state) {
                    mp.setState(state, true);
                }
            },
            'setSerializedState': (mp: MPType, clientId: string, state: string) => {
                mp.setState(state, true);
            },
            'clearSerializedState': (mp: MPType, clientId: string, state: string) => {
                sessionStorage.clear();
                location.reload();
            }
        },

        views: {
            'debugger-host': class extends React.Component<DebuggerViewPropsInterface, {
                showDebugger: boolean,
                serializedState: string
            }> {
                constructor(props: DebuggerViewPropsInterface) {
                    super(props);
                    this._onClick = this._onClick.bind(this);
                    this._updateSerializedState = this._updateSerializedState.bind(this);
                    this.state = {
                        showDebugger: false,
                        serializedState: this.props.serializedState
                    };
                }
                private _updateSerializedState(evt) {
                    this.setState({
                        showDebugger: this.state.showDebugger,
                        serializedState: evt.target.value
                    });
                }
                private _onClick() {
                    this.setState({
                        showDebugger: !this.state.showDebugger,
                        serializedState: this.state.serializedState
                    });
                }
                public componentWillReceiveProps(nextProps) {
                    if (nextProps.serializedState !== this.state.serializedState) {
                        this.setState({
                            serializedState: nextProps.serializedState,
                            showDebugger: this.state.showDebugger
                        });
                    }
                }
                public render() {
                    const hostView = this.props.MP.getPluginSetView(this.props.plugin);
                    const debuggerPaneClassName = this.state.showDebugger ?
                                                  'debugger-pane show' :
                                                  'debugger-pane';
                    return (
                        <div className='debugger-container'>
                            <FontAwesomeIcon className='debugger-icon'
                                         icon="cogs"
                                         onClick={ this._onClick } />
                            <div className={ debuggerPaneClassName }>
                                <div className='debugger-stepper'>
                                    <FontAwesomeIcon className='debugger-stepper-left'
                                                 icon="chevron-left"
                                                 size='2x'
                                                 onClick={ this.props.MP.stepLeft } />
                                    <span className='debugger-stepper-count'>
                                        { (this.props.historyPointer + 1) + ' / ' + this.props.historyCount }
                                    </span>
                                    <FontAwesomeIcon className='debugger-stepper-right'
                                                 icon="chevron-right"
                                                 size='2x'
                                                 onClick={ this.props.MP.stepRight } />
                                </div>
                                <div className='debugger-serialized'>
                                    <textarea value={ this.state.serializedState }
                                              onChange={ this._updateSerializedState } />
                                    <button onClick={ this.props.MP.setSerializedState.bind(this, this.state.serializedState) }>Set State</button>
                                    <button onClick={ this.props.MP.clearSerializedState.bind(this) }>Clear State</button>
                                </div>
                            </div>
                            { hostView }
                        </div>
                    );
                }
            },

            'debugger-client': class extends React.Component<DebuggerViewPropsInterface, {}> {
                public render() {
                    return this.props.MP.getPluginSetView(this.props.plugin);
                }
            }
        }
    }

}

export default NewDebuggerRule;
