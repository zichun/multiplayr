/*
 *
 * gameobject.ts
 *
 * The GameObject class manages a rule.
 *
 */

const NAMESPACE_DELIMITER = '_';

import { ClientTransportInterface } from '../../common/interfaces';
import DataExchange from './dxc';
import Session from './session';
import MPRULES from '../../rules/rules';

import * as DOM from 'react-dom';
import * as React from 'react';

import {
    extendObjClone,
    forEach,
    isArray,
    isFunction
} from '../../common/utils';

import {
    checkReturnMessage,
    forwardReturnMessage,
    returnError,
    returnSuccess
} from '../../common/messages';

import {
    CallbackType,
    DataStoreType,
    ReturnPacketType,
    GameRuleInterface,
    ViewCallbackType
} from '../../common/interfaces';

export class GameObject {

    protected clientId: string;
    protected roomId: string;
    protected isHost: boolean;
    protected container: any;
    protected rule: GameRuleInterface;

    private namespace: string;
    private parent: GameObject;
    private hasDelta: boolean;

    private setupRuleCalled: boolean;
    private onDataChange: any;
    private methods: any;
    private views: any;
    private dataStore: DataStoreType;
    private clients: string[];
    private clientsData: {
        [clientId: string]: {
            ready: boolean,
            active: boolean,
            dataStore: DataStoreType
        }
    };
    private reactProps: {
        [clientId: string]: {
            __view?: string,
            props?: any
        }
    };
    private plugins: { [ruleName: string]: GameObject };
    private playerData: any;

    protected session: Session;
    protected dxc: DataExchange;
    protected MP: any;

    constructor(
        transport: ClientTransportInterface, // Transport object
        container?: any, // (optional) DOM object to render views in.
        namespace?: string, // (optional) namespace string for all variables and methods
        parent?: GameObject // (optional) parent MPGameObject
    ) {
        if (!namespace) {
            namespace = '';
        }

        if (parent === undefined) {
            const session = new Session(transport);
            const dxc = new DataExchange(session);
            this.dxc = dxc;
            this.session = session;
            this.dxc.setGameObject(this);
            this.isHost = false;
            this.clientId = transport.getClientId();
            if (!this.parent && container) {
                sessionStorage.setItem('clientId', this.clientId);
            }
        } else {
            this.parent = parent;
            this.dxc = parent.dxc;
            this.roomId = parent.roomId;
            this.isHost = parent.isHost;
            this.clientId = parent.clientId;
        }

        this.container = container;
        this.namespace = namespace;

        this.hasDelta = true;

        //
        // Set Special variables
        //

        return this;
    }

    public rehost(
        ruleName: string,
        rule: GameRuleInterface,
        roomId: string,
        clientId: string,
        gameState: string,
        cb?: CallbackType<ReturnPacketType>
    ) {
        this.isHost = true;

        this.dxc.rehost(
            roomId,
            clientId,
            (res: ReturnPacketType) => {
                if (!res.success) {
                    this.isHost = false;
                    return forwardReturnMessage(res, cb);
                }

                if (!this.parent && this.container) {
                    sessionStorage.setItem('ruleName', ruleName);
                    sessionStorage.setItem('roomId', roomId);
                    sessionStorage.setItem('clientId', clientId);
                }

                this.roomId = roomId;
                this.setupRule(rule);
                if (!this.parent) {
                    this.tick();
                }

                this.setState(gameState);

                return forwardReturnMessage(res, cb);
            });
    }

    public host(
        ruleName: string,
        rule: GameRuleInterface,
        cb?: CallbackType<ReturnPacketType>
    ) {

        this.isHost = true;

        this.dxc.host(ruleName, (res) => {

            if (!checkReturnMessage(res, 'roomId', cb)) {
                this.isHost = false;
                return;
            }

            if (!this.parent && this.container) {
                sessionStorage.setItem('ruleName', ruleName);
                sessionStorage.setItem('roomId', res.message);
            }

            this.roomId = res.message;
            this.setupRule(rule);
            if (!this.parent) {
                this.tick();
            }

            return forwardReturnMessage(res, cb);
        });
    }

    public rejoin(
        roomId: string,
        clientId: string,
        cb?: CallbackType<ReturnPacketType>
    ) {
        this.dxc.rejoin(roomId, clientId, (res: ReturnPacketType) => {
            if (!checkReturnMessage(res, 'rule', cb)) {
                return;
            }

            this.clientId = clientId;
            this.roomId = roomId;
            this.isHost = false;

            return forwardReturnMessage(res, cb);
        });
    }

    public join(
        roomId: string,
        cb?: CallbackType<ReturnPacketType>
    ) {
        this.dxc.join(roomId, (res: ReturnPacketType) => {
            if (!checkReturnMessage(res, 'rule', cb)) {
                return;
            }

            this.roomId = roomId;
            this.isHost = false;

            return forwardReturnMessage(res, cb);
        });
    }

    public setupRule(
        rule: GameRuleInterface
    ) {
        if (this.setupRuleCalled) {
            throw (new Error('setupRule can only be called once'));
        }

        this.rule = rule;

        this.setupRuleCalled = true;

        this.onDataChange = rule.onDataChange;
        this.methods = rule.methods;
        this.views = rule.views;
        this.MP = GameObject.SetupMPObject(rule.methods, this.isHost, this, this.namespace);

        if (this.isHost) {
            this.dataStore = GameObject.CreateStore(rule.globalData, this);

            this.clients = [];
            this.clientsData = {};
            this.reactProps = {};
            this.reactProps[this.clientId] = {};

            this.playerData = rule.playerData;
        }

        this.plugins = {};
        const prefix = this.namespace === '' ? '' : this.namespace + NAMESPACE_DELIMITER;

        if (this.parent) {
            this.MP.parent = this.parent.MP;
        }

        if (rule.plugins) {
            forEach(rule.plugins, (plugin) => {

                if (typeof plugin !== 'string' || plugin.match(/[^a-zA-Z]/)) {
                    throw (new Error('Invalid plugin name: namespace must be purely alpha'));
                }

                this.plugins[plugin] = new GameObject(
                    null, this.container, prefix + plugin, this
                );

                this.plugins[plugin].setupRule(rule.plugins[plugin]);
            });
        }

        if (!this.isHost && !this.parent) {
            this.dxc.clientReady();
        }
    }

    public getClientId() {
        return this.clientId;
    }

    public getMPObject() {
        return this.MP;
    }

    private hasLocalData(
        variable: string
    ) {
        try {
            this.dataStore(variable);
            return true;
        } catch (e) {
            return false;
        }
    }

    private hasPlayerData(
        playerId: string,
        variable: string
    ) {
        try {
            this.clientsData[playerId].dataStore(variable);
            return true;
        } catch (e) {
            return false;
        }
    }

    private setLocalData(
        variable: string,
        value: any
    ) {
        return this.dataStore(variable).setValue(value);
    }

    private getLocalData(
        variable: string
    ) {
        return this.dataStore(variable).getValue();
    }

    private newClient(
        clientId: string
    ) {
        if (this.isHost) {
            if (!this.parent) {
                this.addNewClient(clientId);
                this.dataChange(true);
            }
        }

        return this;
    }

    public clientIsReady(
        clientId: string
    ) {
        if (!this.isHost) {
            throw (new Error('Only host can call clientIsReady'));
        }

        if (!this.parent) {
            console.log('Client[' + clientId + '] is ready');
        }

        this.clientsData[clientId].ready = true;
        this.setPlayerData(clientId, '__isConnected', true);
        this.hasDelta = true;

        forEach(this.plugins, (plugin) => {
            this.plugins[plugin].clientIsReady(clientId);
        });

        if (!this.parent) {
            this.tick();
        }
    }

    public addNewClient(
        clientId: string,
        ready = false
    ) {
        if (!this.isHost) {
            throw (new Error('Only host can call addNewClient'));
        }

        if (!this.parent) {
            console.log('Client[' + clientId + '] connected');
        }

        forEach(this.plugins, (plugin) => {
            this.plugins[plugin].addNewClient(clientId);
        });

        if (this.clients.indexOf(clientId) !== -1) {
            if (this.clientsData[clientId].active === false) {
                return this.rejoinClient(clientId);
            } else {
                throw (new Error('Client cannot re-join an active session'));
            }
        }

        this.clients.push(clientId);
        this.clientsData[clientId] = {
            ready: ready,
            active: true,
            dataStore: GameObject.CreateStore(this.playerData, this)
        };

        this.reactProps[clientId] = {
            __view: '',
            props: {}
        };

        this.setPlayerData(clientId, '__isConnected', ready);
        this.setPlayerData(clientId, '__clientId', clientId);
        this.hasDelta = true;

        return this;
    }

    private rejoinClient(
        clientId: string
    ) {
        if (this.isHost) {

            if (!this.parent) {
                console.log('Client[' + clientId + '] reconnected');
            }

            if (clientId === this.clientId) {
                return;
            }

            this.clientsData[clientId].ready = false;
            this.clientsData[clientId].active = true;
            this.setPlayerData(clientId, '__isConnected', false);
        }
        return this;
    }

    private disconnectClient(
        clientId: string
    ) {
        if (this.isHost) {

            if (!this.parent) {
                console.log('Client[' + clientId + '] disconnected');
            }

            this.setPlayerData(clientId, '__isConnected', false);

            //                this.clients.splice(this.clients.indexOf(clientId), 1);
            this.clientsData[clientId].active = false;
            this.clientsData[clientId].ready = false;

            this.hasDelta = true;
            if (!this.parent) {
                this.tick();
            }

        }
        return this;
    }

    private removeClient(
        clientId: string
    ) {
        if (this.isHost) {
            if (!this.parent) {
                this.rootRemoveClient(clientId);
            } else {
                this.parent.rootRemoveClient(clientId);
            }

            this.hasDelta = true;

            if (!this.parent) {
                this.tick();
            }
        }

        return this;
    }

    private rootRemoveClient(
        clientId: string
    ) {
        if (!this.isHost) {
            throw (new Error('Only host can call addNewClient'));
        }

        //            if (!this.parent) {
        console.log('Client[' + clientId + '] removed');
        //            }

        forEach(this.plugins, (plugin) => {
            this.plugins[plugin].rootRemoveClient(clientId);
        });

        this.clients.splice(this.clients.indexOf(clientId), 1);
        delete this.clientsData[clientId];

        return this;
    }

    private processTick() {
        let changed = false;

        if (this.isHost) {
            forEach(this.plugins, (plugin) => {
                if (this.plugins[plugin].processTick()) {
                    changed = true;
                }
            });

            if ((changed || this.hasDelta) &&
                isFunction(this.onDataChange)) {

                this.hasDelta = false;
                const render = this.onDataChange(this.MP, this.rule);

                if (!this.parent && this.container) {
                    const gameState = this.getState();
                    sessionStorage.setItem('gameState', gameState);
                }

                if (this.parent) {
                    forEach(this.reactProps, (client) => {
                        this.parent.setViewProps(
                            client,
                            getLastNamespace(this.namespace),
                            this.reactProps[client]);
                    });
                }

                if (render && !this.parent) {
                    this.renderViews();
                }

                changed = true;
            }
        } else {
            // todo: proper convention for error
            // or better still, don't expose this to client in the first place
        }

        return changed;
    }

    private tick() {
        if (this.isHost) {
            if (this.parent) {
                return this.parent.tick();
            } else {
                return this.processTick();
            }
        }
        return false;
    }

    protected dataChange(
        forceTick: boolean
    ) {
        if (this.isHost) {

            this.hasDelta = true;

            if (this.parent) {
                this.parent.dataChange(false);
            }

            if (forceTick) {
                this.tick();
            }

        } else {
            throw (new Error('Invalid call'));
        }

        return this;
    }

    private renderViews() {
        if (this.parent) {
            throw (new Error('Only top level gameobject can render views'));
        }

        const promises = [];
        forEach(this.reactProps, (client) => {
            if (this.reactProps[client].__view) {
                promises.push(this.qHostSetView(client, this.reactProps[client].__view, this.reactProps[client], this.container));
            }
        });

        Promise.all(promises)
            .then((results) => {
                return true;
            })
            .catch(console.error);
    }

    private getView(displayName: string) {
        // todo: re-write this. this should be the corresponding getter for setView
        return this.views[displayName];
    }

    private propagateProps(
        props?: any
    ) {
        props = props || {};

        if (this.reactProps === undefined) {
            this.reactProps = {};
        }

        if (this.reactProps[this.clientId] === undefined) {
            this.reactProps[this.clientId] = {};
        }

        this.reactProps[this.clientId] = props;

        forEach(this.plugins, (plugin) => {
            if (props.hasOwnProperty(plugin)) {
                this.plugins[plugin].propagateProps(props[plugin]);
            }
        });
    }

    private viewCallback: ViewCallbackType;
    public setViewCallback(
        callback: ViewCallbackType
    ) {
        this.viewCallback = callback;
    }

    public hostSetView(
        clientId: string,
        displayName: string,
        props: any,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {
        props = props || {};

        if (this.isHost === false && clientId !== this.clientId) {
            return returnError(cb, 'only host can set views');
        }

        if (container && !this.isHost) {
            this.propagateProps(props);
        }

        if (clientId === null || clientId === this.clientId) {
            // this means that clientId matches request. we'll go ahead to render the view

            if (this.views[displayName] !== undefined) {
                if (this.viewCallback !== undefined) {
                    this.viewCallback(displayName, props);
                }

                // we have this view
                const view = this.runReactView(displayName, props);
                if (container) {
                    return DOM.render(view, container);
                } else {
                    // todo: hackish. abstract out as a sync op
                    return view;
                }
            } else {
                // we'll forward it to a plugin
                const splits = getFirstNamespace(displayName);
                const namespace = splits[0];

                if (!namespace || this.plugins[namespace] === undefined) {
                    throw (new Error('No such views: ' + displayName));
                } else {
                    return this.plugins[namespace].hostSetView(
                        clientId,
                        splits[1],
                        props[namespace],
                        container,
                        cb);
                }
            }
        } else {
            // Not me. forward request to client
            if (this.clientsData[clientId] !== undefined &&
                this.clientsData[clientId].active &&
                this.clientsData[clientId].ready) {

                this.dxc.setView(clientId, displayName, props, cb);
            }
        }

        return this;
    }

    private qHostSetView(
        clientId: string,
        displayName: string,
        props: any,
        container: any,
        cb?: CallbackType<ReturnPacketType>
    ) {
        return new Promise((resolve, reject) => {
            const args = [];

            this.hostSetView(
                clientId,
                displayName,
                props,
                container,
                (res) => {
                    if (!res.success) {
                        reject(new Error(res.message));
                    } else {
                        resolve(res.message);
                    }
                });

        });
    }

    private runReactView(
        reactDisplayName: string,
        props: any
    ) {
        const reactClass = this.getView(reactDisplayName);

        props = props || {};
        props.MP = this.MP;

        return React.createElement(reactClass, props);
    }

    private execMethod(
        fromClientId: string,
        method: string,
        args: any
    ) {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can invoke methods'));
        }

        if (this.methods[method] !== undefined) {

            const execMethodsCallArgs = [this.MP, fromClientId];
            let i = 0;

            for (i = 0; i < args.length; i = i + 1) {
                execMethodsCallArgs.push(args[i]);
            }

            const tr = this.methods[method].apply(this.MP, execMethodsCallArgs);
            this.tick();

            return tr;
        } else {
            // we'll forward it to a plugin
            const splits = getFirstNamespace(method);
            const namespace = splits[0];

            if (!namespace || this.plugins[namespace] === undefined) {
                throw (new Error('No such method: ' + method));
            } else {
                return this.plugins[namespace].execMethod(fromClientId, splits[1], args);
            }
        }
    }

    ///
    /// Methods that will be exposed to game rules
    ///

    private getData(
        variable: string
    ) {
        if (this.isHost) {
            if (this.hasLocalData(variable)) {
                return this.getLocalData(variable);
            } else {
                const splits = getFirstNamespace(variable);
                const namespace = splits[0];

                if (!namespace || this.plugins[namespace] === undefined) {
                    throw (new Error('Variable [' + variable + '] does not exists'));
                } else {
                    return this.plugins[namespace].getData(splits[1]);
                }
            }
        } else {
            throw (new Error('Only host can get data'));
        }
    }

    private setData(
        variable: string,
        value: any
    ) {
        if (this.isHost) {
            // Current scope is host, and so data belongs to self
            if (this.hasLocalData(variable)) {
                return this.setLocalData(variable, value);
            } else {
                const splits = getFirstNamespace(variable);
                const namespace = splits[0];

                if (!namespace || this.plugins[namespace] === undefined) {
                    throw (new Error('Variable [' + variable + '] does not exists'));
                } else {
                    this.plugins[namespace].setData(splits[1], value);
                }
            }
        } else {
            throw (new Error('Only host can set data'));
        }

        return this;
    }

    private getPlayerData(
        playerId: string,
        variable: string
    ) {
        let i = 0;

        if (this.isHost === false) {
            throw (new Error('Only host can get player data'));
        } else {

            if (this.clientsData[playerId] === undefined) {
                throw (new Error('Client [' + playerId + '] does not exists'));
            }

            const getVariable = (variable: string) => {
                if (this.hasPlayerData(playerId, variable)) {
                    return this.clientsData[playerId].dataStore(variable).getValue();
                } else {
                    const splits = getFirstNamespace(variable);
                    const namespace = splits[0];

                    if (!namespace || this.plugins[namespace] === undefined) {
                        throw (new Error('Variable [' + variable + '] does not exists'));
                    } else {
                        return this.plugins[namespace].getPlayerData(playerId, splits[1]);
                    }
                }
            };

            if (isArray(variable)) {
                const tr = {};
                for (i = 0; i < variable.length; i = i + 1) {
                    tr[variable[i]] = getVariable(variable[i]);
                }
                return tr;
            } else {
                return getVariable(variable);
            }

        }
    }

    private setPlayerData(
        playerId: string,
        variable: string,
        value: any
    ) {
        if (this.isHost === false) {
            throw (new Error('Only host can set player data'));
        } else {
            if (this.clientsData[playerId] === undefined) {
                throw (new Error('Client [' + playerId + '] does not exists'));
            } else if (this.clientsData[playerId].active === false) {
                // todo: think about disconnection implication
                throw (new Error('Client [' + playerId + '] has disconnected'));
            } else {
                if (this.hasPlayerData(playerId, variable)) {
                    return this.clientsData[playerId].dataStore(variable).setValue(value);
                } else {
                    const splits = getFirstNamespace(variable);
                    const namespace = splits[0];

                    if (!namespace || this.plugins[namespace] === undefined) {
                        throw (new Error('Variable [' + variable + '] does not exists'));
                    } else {
                        this.plugins[namespace].setPlayerData(playerId, splits[1], value);
                    }
                }
            }
        }

        return this;
    }

    ///
    /// Views related methods.
    ///

    public setView(
        clientId: string,
        view: string
    ) {
        if (this.isHost) {
            this.setViewProps(clientId, '__view', view);
        } else {
            throw (new Error('Only host can call setView'));
        }
        return this;
    }

    private setViewProps(
        clientId: string,
        key: string,
        value: any
    ) {
        // todo: maybe expose this API only for ondatachange, to enforce data drivenness
        if (this.isHost) {
            this.reactProps[clientId][key] = value;
        } else {
            throw (new Error('Only host can call setViewProps'));
        }

        return this;
    }

    private getPluginView(
        subView: string,
        viewName: string,
        extendProps?: any,
        props?: any
    ) {
        props = props || (this.reactProps && this.reactProps[this.clientId]);

        if (this.plugins[subView] !== undefined) {
            const it = this.plugins[subView];
            const extendedProps = props[subView];

            const newProps = extendObjClone(extendedProps, extendProps, true);

            return it.hostSetView(
                it.clientId,
                viewName,
                newProps,
                false);

        } else {
            const splits = getFirstNamespace(subView);
            const namespace = splits[0];

            if (!namespace || this.plugins[namespace] === undefined) {
                throw (new Error('Plugin [' + namespace + '] does not exists'));
            } else {
                return this.plugins[namespace].getPluginView(
                    splits[1],
                    viewName,
                    extendProps,
                    props[namespace]);
            }
        }
    }

    private getPluginSetView(
        subView: string,
        props?: any
    ) {
        props = props || (this.reactProps && this.reactProps[this.clientId]);

        if (this.plugins[subView] !== undefined) {
            const it = this.plugins[subView];

            if (props[subView].__view) {
                return it.hostSetView(
                    it.clientId,
                    props[subView].__view,
                    props[subView],
                    false);
            } else {
                return null;
            }

        } else {
            const splits = getFirstNamespace(subView);
            const namespace = splits[0];

            if (!namespace || this.plugins[namespace] === undefined) {
                throw (new Error('Plugin [' + namespace + '] does not exists'));
            } else {
                return this.plugins[namespace].getPluginSetView(splits[1], props[namespace]);
            }
        }
    }

    private deleteViewProps(
        clientId: string,
        key: string
    ) {
        delete this.reactProps[clientId][key];
        return this;
    }

    ///
    /// Players helper functions
    ///

    private playersForEach(
        fn: any // todo: type fn correctly
    ) {
        if (!this.isHost) {
            throw (new Error('Only host can call playersForEach'));
        }

        if (this.parent) {
            this.parent.playersForEach(fn);
        } else {
            this.clients.forEach(fn);
        }

        return this;
    }

    private playersCount() {
        if (!this.isHost) {
            throw (new Error('Only host can call playersCount'));
        }

        if (this.parent) {
            return this.parent.playersCount();
        } else {
            return this.clients.length;
        }
    }

    private getPlayersData(
        variable: string
    ) {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can accumulate all players data'));
        }

        const cnter = this.clients.length;
        const accumulatedResults = {};

        this.clients.forEach((client, i) => {
            accumulatedResults[i] = this.getPlayerData(client, variable);
        });

        return accumulatedResults;
    }

    ///
    /// Methods to serialize and deserialize a game's state.
    ///

    private getHostStore() {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can serialize state'));
        }
        const store = {};

        forEach(this.rule.globalData, (variable) => {
            store[variable] = this.dataStore(variable).getValue();
        });

        return store;
    }

    private getClientsStore() {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can get clients\' store'));
        }

        const clientsStore = {};
        forEach(this.clientsData, (clientId, playerStore) => {
            const store = {};

            forEach(this.rule.playerData, (variable) => {
                store[variable] = playerStore.dataStore(variable).getValue();
            });

            clientsStore[clientId] = store;
        });

        return clientsStore;
    }

    private getPluginsStore() {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can get pluginsStore'));
        }
        const pluginsStore = {};

        forEach(this.plugins, (pluginName, plugin) => {
            pluginsStore[pluginName] = plugin.getState();
        });

        return pluginsStore;
    }

    public getState() {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can get state object'));
        }

        const tr = {
            hostStore: this.getHostStore(),
            clientsStore: this.getClientsStore(),
            pluginsStore: this.getPluginsStore()
        };

        return JSON.stringify(tr);
    }

    private setHostStore(hostStore: any) {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can set host state'));
        }

        forEach(this.rule.globalData, (variable) => {
            this.dataStore(variable).setValue(hostStore[variable]);
        });
    }

    private setPluginsStore(
        pluginStore: any,
        mapPlayers = false
    ) {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can set plugin state'));
        }

        forEach(this.plugins, (pluginName, plugin) => {
            plugin.setState(pluginStore[pluginName], mapPlayers);
        });
    }

    private setClientsStore(
        clientsStore: any,
        mapPlayers = false
    ) {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can set clients\' store'));
        }

        if (mapPlayers) {
            let dataCount = 0;
            const clientsMap = {};

            forEach(clientsStore, (clientId, store) => {
                clientsMap[dataCount] = clientId;
                dataCount = dataCount + 1;
            });

            forEach(this.clientsData, (clientId, playerStore) => {
                dataCount = dataCount - 1;
            });

            if (dataCount !== 0) {
                alert('Number connected clients do not match state');
                throw (new Error('Connected clients do not match state'));
            }

            forEach(this.clientsData, (clientId, playerStore) => {
                forEach(this.rule.playerData, (variable) => {
                    playerStore.dataStore(variable).setValue(clientsStore[clientsMap[dataCount]][variable]);
                });
                dataCount = dataCount + 1;
            });
            return;
        }

        forEach(this.clientsData, (clientId, playerStore) => {
            if (!clientsStore.hasOwnProperty(clientId) === undefined) {
                throw (new Error('Invalid client store state - no ' + clientId));
            }
            forEach(this.rule.playerData, (variable) => {
                playerStore.dataStore(variable).setValue(clientsStore[clientId][variable]);
            });
        });

        forEach(clientsStore, (clientId, store) => {
            if (!this.clientsData.hasOwnProperty(clientId)) {
                this.addNewClient(clientId, true);

                forEach(this.rule.playerData, (variable) => {
                   this.clientsData[clientId].dataStore(variable).setValue(clientsStore[clientId][variable]);
                });
            }
        });
    }

    public setState(
        stateString: string,
        mapPlayers = false
    ) {
        if (!this.isHost) {
            throw (new Error('Invalid call: only host can set state'));
        }

        const state = JSON.parse(stateString);

        if (!state.hostStore) {
            throw (new Error('Invalid state - no host store'));
        }

        this.setHostStore(state.hostStore);
        this.setClientsStore(state.clientsStore, mapPlayers);
        this.setPluginsStore(state.pluginsStore, mapPlayers);

        if (!this.parent) {
            this.dataChange(true);
        }
    }

    /**
     * Sets up the object that will be passed to the rule (views and methods)
     *  so that the rule can augment gamestates. Exposes methods such as getData, setData etc.
     */

    protected static SetupMPObject(
        methods: { [methodName: string]: (mb: any, clientId: string, ...args: any[]) => any; },
        isHost: boolean,
        gameObj: GameObject,
        namespace: string
    ) {
        const prefix = namespace ? namespace + '_' : '';
        function hostMethodWrapper(method: string) {
            return function () {
                return gameObj.execMethod(gameObj.clientId, method, arguments);
            };
        }

        function hostExposedMethodWrapper(method: string) {
            return function () {
                return gameObj[method].apply(gameObj, arguments);
            };
        }

        function clientMethodWrapper(method: string) {
            return function () {
                return gameObj.dxc.execMethod(prefix + method, arguments);
            };
        }

        const obj = {
            getView: hostExposedMethodWrapper('getView'),
            getPluginView: hostExposedMethodWrapper('getPluginView'),
            getPluginSetView: hostExposedMethodWrapper('getPluginSetView'),
            clientId: gameObj.clientId,
            hostId: gameObj.clientId, // todo: fix this for normal clients
            roomId: gameObj.roomId
        };

        forEach(methods, (method) => {
            if (isHost) {
                obj[method] = hostMethodWrapper(method);
            } else {
                obj[method] = clientMethodWrapper(method);
            }
        });

        if (isHost) {
            // todo: views shouldn't be given methods below, even on host.
            //       instead views should call a method defined in the rule instead.
            // Expose methods
            const exposed = ['getData', 'setData', 'getState', 'setState',
                'getPlayerData', 'setPlayerData', 'getPlayersData',
                'setView', 'setViewProps', 'deleteViewProps',
                'playersForEach', 'playersCount',
                'removeClient'];
            exposed.forEach((method) => {
                obj[method] = hostExposedMethodWrapper(method);
            });

        }

        return obj;
    }

    protected static CreateStore(
        dataObj: any,
        gameObj: GameObject
    ): DataStoreType {
        const store = {
            __isConnected: true,
            __clientId: null
        };

        forEach(dataObj, (variable) => {
            if (isFunction(dataObj[variable])) {
                store[variable] = dataObj[variable]();
            } else if (dataObj[variable] !== undefined) {
                store[variable] = dataObj[variable];
            }
        });

        /**
         * Exposes local variable store as synchronous operations
         */
        return (variable: string) => {
            if (!store.hasOwnProperty(variable)) {
                throw (new Error('Variable ' + variable + ' is not declared'));
            }

            return {
                getValue: () => {
                    return store[variable];
                },
                setValue: (newValue: any) => {
                    store[variable] = newValue;

                    gameObj.dataChange(false);
                    return newValue;
                }
            };
        };
    }

}

/**
 * Extract out the first namespace
 * e.g "Lobby"_Apple_Car -> "Lobby"
 */
function getFirstNamespace(variable: string) {
    const s = variable.split('_');
    if (s.length === 0) {
        return [null, variable];
    } else {
        const namespace = s[0];
        return [namespace, s.slice(1, s.length).join('_')];
    }
}

function getLastNamespace(variable: string) {
    const s = variable.split('_');
    if (s.length === 0) {
        return variable;
    } else {
        return s[s.length - 1];
    }
}

export default GameObject;
