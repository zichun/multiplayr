/**
 * debugger.tsx
 */
import * as React from 'react';
import * as FontAwesome from 'react-fontawesome';
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

/**
 * @class GameStates
 * A store for a history of game states. While game rules are designed to be stateless, the debugger
 * rule take an exception and store the history in memory. This is because if the gamestate history is
 * stored within the state of the game rule, then there will be a cyclic reference during serialization.
 */
class GameStates {
    private gameStates: any;
    private bufferSize: number;
    private pointer: number;

    constructor(size: number) {
        this.bufferSize = size;
        this.gameStates = [];
        this.pointer = 0;
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

        if (this.count()) {
            const previousState = this.top();
            const thisState = JSON.stringify(state);

            if (JSON.stringify(previousState) === thisState) {
                // if the serialized state is the same, skip inserting this state.
                return;
            }

            if (this.pointer + 1 < this.count() &&
                JSON.stringify(this.gameStates[this.pointer + 1]) === thisState) {
                // if the serialized state is the same as the next, skip inserting this state.
                return;
            }

            if (Object.keys(previousState.clientsStore).length !== Object.keys(state.clientsStore).length) {
                // If the number of players differ, we start from scratch.
                this.clear();
            } else if (this.pointer !== this.count() - 1) {
                const newGameStates = this.gameStates.splice(0, this.pointer + 1);
                this.gameStates = newGameStates;
            }
        }

        this.gameStates.push(state);

        if (this.count() > this.bufferSize) {
            this.gameStates.splice(0, 1);
        }

        this.pointer = this.count() - 1;
    }
}

const gameStatesHistory = new GameStates(10);

interface DebuggerRuleInterface extends GameRuleInterface {
    gameStates?: any
}

export const Debugger: GameRuleInterface = {

    name: 'debugger',
    css: [],

    plugins: {},

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

        gameStatesHistory.push(mp.getState());

        mp.setViewProps(mp.hostId, 'plugin', debuggee);
        mp.setViewProps(mp.hostId, 'historyCount', gameStatesHistory.count());
        mp.setViewProps(mp.hostId, 'historyPointer', gameStatesHistory.getPointer());
        mp.setViewProps(mp.hostId, 'serializedState', JSON.stringify(gameStatesHistory.top()));
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
                mp.setState(state);
            }
        },
        'stepRight': (mp: MPType, clientId: string) => {
            const state = gameStatesHistory.seekRight();
            if (state) {
                mp.setState(state);
            }
        },
        'setSerializedState': (mp: MPType, clientId: string, state: string) => {
            mp.setState(JSON.parse(state), true);
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
                        <FontAwesome className='debugger-icon'
                                     name='cogs'
                                     onClick={ this._onClick } />
                        <div className={ debuggerPaneClassName }>
                            <div className='debugger-stepper'>
                                <FontAwesome className='debugger-stepper-left'
                                             name='chevron-left'
                                             size='2x'
                                             onClick={ this.props.MP.stepLeft } />
                                <span className='debugger-stepper-count'>
                                    { (this.props.historyPointer + 1) + ' / ' + this.props.historyCount }
                                </span>
                                <FontAwesome className='debugger-stepper-right'
                                             name='chevron-right'
                                             size='2x'
                                             onClick={ this.props.MP.stepRight } />
                            </div>
                            <div className='debugger-serialized'>
                                <textarea value={ this.state.serializedState }
                                          onChange={ this._updateSerializedState } />
                                <button onClick={ this.props.MP.setSerializedState.bind(this, this.state.serializedState) }>Set State</button>
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
};
