/**
 * test_lobby.ts - Tests for the Lobby plugin ordering and behavior
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { GameRuleTest } from '../GameRuleTest';
import { Lobby } from '../../rules/lobby/lobby';
import { LobbyView, LobbyHelloView } from '../../rules/lobby/LobbyView';
import * as React from 'react';

describe('Lobby Plugin Tests', () => {
    it('orders the host at the top (index 0) and joining players in join sequence', () => {
        // Trio has hostAsPlayer: true and uses the lobby plugin
        const test = new GameRuleTest('trio', 3); // host + 3 clients

        const hostGo = (test as any).hostGameObject;
        const hostId = hostGo.getClientId();
        const client0Id = test.getPlayerClientId(0);
        const client1Id = test.getPlayerClientId(1);
        const client2Id = test.getPlayerClientId(2);

        const lobbyPlugin = hostGo.plugins['lobby'];
        assert.ok(lobbyPlugin, 'Lobby plugin must exist');

        const hostProps = lobbyPlugin.reactProps[hostId];
        assert.ok(hostProps, 'Host lobby props must exist');

        const { clientIds, names, accents, icons, playersConnection } = hostProps;

        // 1. Host must be at index 0 (the top)
        assert.strictEqual(clientIds[0], hostId, 'Host ID must be at index 0');
        assert.strictEqual(names[0], hostGo.plugins['lobby'].dataStore('name').getValue(), 'Host name must be at index 0');
        assert.strictEqual(playersConnection[0], true, 'Host connection must be true at index 0');

        // 2. Joining players must be ordered in the sequence they join (indices 1, 2, 3)
        assert.strictEqual(clientIds[1], client0Id, 'Client 0 must be at index 1');
        assert.strictEqual(clientIds[2], client1Id, 'Client 1 must be at index 2');
        assert.strictEqual(clientIds[3], client2Id, 'Client 2 must be at index 3');
        assert.strictEqual(clientIds.length, 4, 'Total clientIds should be 4 (1 host + 3 clients)');
        assert.strictEqual(names.length, 4, 'Total names should be 4');
        assert.strictEqual(accents.length, 4, 'Total accents should be 4');
        assert.strictEqual(icons.length, 4, 'Total icons should be 4');
        assert.strictEqual(playersConnection.length, 4, 'Total playersConnection should be 4');
    });

    it('updates player data at correct positions when names and accents change', () => {
        const test = new GameRuleTest('trio', 2); // host + 2 clients

        const hostGo = (test as any).hostGameObject;
        const hostId = hostGo.getClientId();
        const client0Id = test.getPlayerClientId(0);
        const client1Id = test.getPlayerClientId(1);

        const lobbyPlugin = hostGo.plugins['lobby'];

        const client0Go = (test as any).clientsGameObjects[0];
        const client1Go = (test as any).clientsGameObjects[1];

        // Change host name and accent via host lobby MP
        lobbyPlugin.getMPObject().setName('GameMaster');
        lobbyPlugin.getMPObject().setAccent('#FF4136');

        // Change client 0 name and accent via client lobby MP
        client0Go.plugins['lobby'].getMPObject().setName('Alice');
        client0Go.plugins['lobby'].getMPObject().setAccent('#0074D9');

        // Change client 1 name and accent via client lobby MP
        client1Go.plugins['lobby'].getMPObject().setName('Bob');
        client1Go.plugins['lobby'].getMPObject().setAccent('#2ECC40');

        const hostProps = lobbyPlugin.reactProps[hostId];
        assert.strictEqual(hostProps.names[0], 'GameMaster', 'Host name at index 0 should update');
        assert.strictEqual(hostProps.accents[0], '#FF4136', 'Host accent at index 0 should update');

        assert.strictEqual(hostProps.names[1], 'Alice', 'Client 0 name at index 1 should update');
        assert.strictEqual(hostProps.accents[1], '#0074D9', 'Client 0 accent at index 1 should update');

        assert.strictEqual(hostProps.names[2], 'Bob', 'Client 1 name at index 2 should update');
        assert.strictEqual(hostProps.accents[2], '#2ECC40', 'Client 1 accent at index 2 should update');
    });

    it('handles showHost correctly in LobbyView and player-tag', () => {
        // Test player-tag rendering
        const PlayerTagComponent = Lobby.views['player-tag'];
        assert.ok(PlayerTagComponent, 'player-tag view should exist');

        const clientIds = ['host-id', 'client-1', 'client-2'];
        const names = ['HostPlayer', 'PlayerOne', 'PlayerTwo'];
        const accents = ['#111', '#222', '#333'];
        const icons = [0, 1, 2];

        // When clientId is used
        const tagHost = new PlayerTagComponent({
            clientId: 'host-id',
            clientIds,
            names,
            accents,
            icons,
            MP: {} as any
        });
        const renderedHost: any = tagHost.render();
        assert.strictEqual(renderedHost.props.children[1].props.children, 'HostPlayer');

        const tagClient1 = new PlayerTagComponent({
            clientId: 'client-1',
            clientIds,
            names,
            accents,
            icons,
            MP: {} as any
        });
        const renderedClient1: any = tagClient1.render();
        assert.strictEqual(renderedClient1.props.children[1].props.children, 'PlayerOne');

        // When clientIndex is used with showHost = false (offset by 1 to skip host)
        const tagIndex0NoHost = new PlayerTagComponent({
            clientIndex: 0,
            showHost: false,
            clientIds,
            names,
            accents,
            icons,
            MP: {} as any
        });
        const renderedIndex0: any = tagIndex0NoHost.render();
        assert.strictEqual(renderedIndex0.props.children[1].props.children, 'PlayerOne');

        // When clientIndex is used with showHost = true (host is index 0)
        const tagIndex0WithHost = new PlayerTagComponent({
            clientIndex: 0,
            showHost: true,
            clientIds,
            names,
            accents,
            icons,
            MP: {} as any
        });
        const renderedHostByIndex: any = tagIndex0WithHost.render();
        assert.strictEqual(renderedHostByIndex.props.children[1].props.children, 'HostPlayer');
    });

    it('renders host at the top in host-roommanagement view', () => {
        const RoomManagementComponent = Lobby.views['host-roommanagement'];
        assert.ok(RoomManagementComponent, 'host-roommanagement view should exist');

        const clientIds = ['host-id', 'client-1', 'client-2'];
        const names = ['HostPlayer', 'PlayerOne', 'PlayerTwo'];
        const accents = ['#111', '#222', '#333'];
        const icons = [0, 1, 2];
        const playersConnection = [true, true, true];

        const mockMP = {
            hostId: 'host-id',
            clientId: 'host-id',
            roomId: '123456',
            parent: { ruleName: 'trio' }
        };

        const comp = new RoomManagementComponent({
            MP: mockMP as any,
            clientIds,
            names,
            accents,
            icons,
            playersConnection,
            playerCount: 2
        });

        const rendered: any = comp.render();
        // The room-players-list is children[1] in the container
        const playerList = rendered.props.children[1];
        const rows = playerList.props.children;

        assert.strictEqual(rows.length, 3, 'Should render 3 player cards');
        // First card (index 0) must be host
        assert.ok(rows[0].props.className.includes('is-host'), 'First row must be host');
        // Second and third rows must be the players
        assert.ok(!rows[1].props.className.includes('is-host'), 'Second row must not be host');
        assert.ok(!rows[2].props.className.includes('is-host'), 'Third row must not be host');
    });

    it('allows host to reorder players placing host anywhere, and mp.getPlayers() reflects custom order', () => {
        const test = new GameRuleTest('trio', 2); // host + 2 clients

        const hostGo = (test as any).hostGameObject;
        const hostId = hostGo.getClientId();
        const client0Id = test.getPlayerClientId(0);
        const client1Id = test.getPlayerClientId(1);

        const lobbyPlugin = hostGo.plugins['lobby'];
        const lobbyMP = lobbyPlugin.getMPObject();

        // Default: [hostId, client0Id, client1Id]
        assert.deepStrictEqual(hostGo.getPlayers(), [hostId, client0Id, client1Id]);

        // Host reorders so client 0 is 1st, Host is 2nd, client 1 is 3rd:
        // move fromIndex 0 (host) to toIndex 1
        lobbyMP.reorderPlayer(0, 1);

        // Verify lobby reactProps reflect new order
        const hostProps = lobbyPlugin.reactProps[hostId];
        assert.deepStrictEqual(hostProps.clientIds, [client0Id, hostId, client1Id]);

        // Verify mp.getPlayers() returns new order
        assert.deepStrictEqual(hostGo.getPlayers(), [client0Id, hostId, client1Id]);

        // Start Trio game
        hostGo.getMPObject().startGame();

        // Check Trio game state: current turn should be client0Id, NOT hostId!
        const trioGameState = hostGo.dataStore('gameState').getValue();
        assert.ok(trioGameState, 'Trio game state should exist');
        assert.strictEqual(trioGameState.data.currentPlayerId, client0Id, 'Client 0 should take the first turn');
        assert.deepStrictEqual(trioGameState.playerIds, [client0Id, hostId, client1Id], 'Trio player turn order must match custom order');
    });

    it('preserves custom order on game restart', () => {
        const test = new GameRuleTest('trio', 2); // host + 2 clients

        const hostGo = (test as any).hostGameObject;
        const hostId = hostGo.getClientId();
        const client0Id = test.getPlayerClientId(0);
        const client1Id = test.getPlayerClientId(1);

        const lobbyPlugin = hostGo.plugins['lobby'];
        const lobbyMP = lobbyPlugin.getMPObject();

        // Host places themselves last: [client0Id, client1Id, hostId]
        lobbyMP.reorderPlayer(0, 2);
        assert.deepStrictEqual(hostGo.getPlayers(), [client0Id, client1Id, hostId]);

        // Start game
        hostGo.getMPObject().startGame();
        let trioGameState = hostGo.dataStore('gameState').getValue();
        assert.strictEqual(trioGameState.data.currentPlayerId, client0Id);

        // Restart game
        hostGo.getMPObject().restartGame();
        trioGameState = hostGo.dataStore('gameState').getValue();
        assert.strictEqual(trioGameState.data.currentPlayerId, client0Id);
        assert.deepStrictEqual(trioGameState.playerIds, [client0Id, client1Id, hostId]);
    });

    it('renders drag handles and reorder buttons in LobbyHelloView', () => {
        const HelloComponent = Lobby.views['LobbyHelloView'] || LobbyHelloView;
        assert.ok(HelloComponent, 'LobbyHelloView should exist');

        let movedUp = false;
        let movedDown = false;

        const view = new HelloComponent({
            name: 'Alice',
            icon: 1,
            accent: '#3b82f6',
            isItemHost: false,
            canReorder: true,
            onMoveUp: () => { movedUp = true; },
            onMoveDown: () => { movedDown = true; }
        });

        const rendered: any = view.render();
        assert.ok(rendered.props.className.includes('lobby-player-card'));

        // Check drag handle
        const dragHandle = rendered.props.children[0];
        assert.strictEqual(dragHandle.props.className, 'lobby-card-drag-handle');

        // Check reorder buttons
        const reorderBtns = rendered.props.children[3];
        assert.strictEqual(reorderBtns.props.className, 'lobby-card-reorder-btns');

        const upBtn = reorderBtns.props.children[0];
        const downBtn = reorderBtns.props.children[1];

        upBtn.props.onClick();
        assert.strictEqual(movedUp, true, 'Clicking up button should invoke onMoveUp');

        downBtn.props.onClick();
        assert.strictEqual(movedDown, true, 'Clicking down button should invoke onMoveDown');
    });
});

