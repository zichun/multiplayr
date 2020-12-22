# Multiplayr

Multiplayr is a platform for creating games where your devices (smartphones / tablets) host the game assets. The game rules
are written in a data-driven, declarative (reactive) fashion.

In each game set up, there will be a host device, and several (or possibly no) client devices. Both the host and clients will
load the same game rule definition. A game rule defintion comprises 3 components - methods, data and views. Views are what will
be rendered on the device screens, data defines the state of the game, and methods are used to change the data.

**Only the host has access to read and write data**. The host will determine the state of the game based on the data, and push
the views down to the clients. Whenever a client needs to change its data, it calls a method, which will be routed back to the
host and executed on the host device. Whenever there is a data change, the host will reconcile the state and update the views
accordingly.

## Building and running

```
npm install
gulp
node build\app
```

## Rules Definition

GameRules implement the `GameRuleInterface` interface, which is a javascript object with the following keys:

| Key            | Type                                                                         | Description                                       |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `name`         | `string`                                                                     | Name of the Rule                                  |
| `plugins`      | `{ [gameName: string]: GameRuleInterface }`                                  | List of plugins                                   |
| `globalData`   | `{ [varName: string]: any }`                                                 | Set of data available at the global scope         |
| `playerData`   | `{ [varName: string]: any }`                                                 | Set of data specific to each client               |
| `onDataChange` | `(mp: MPType) => boolean`                                                    | Function to reconcile state whenever data changed |
| `methods`      | `{[methodName: string]: (mb: any, clientId: string, ...args: any[]) => any}` | List of methods that views can call               |
| `views`        | `{ [viewName: string]: ReactComponent }`                                     | A set of React Components                         |

A gamerule is written in a declarative manner. Each gamerule has a set of data (global and player-specific) with initial values that are defined in
the `globalData` and `playerData` keys. Whenever it is changed, the `onDataChange` callback will be invoked. There, the gamerule will,
through the `mp: MPType` object, reconcile the state of the game based on the data and set the corresponding React views on the host and clients.
The views can execute methods defined in the `methods` key (for instance, in response to a user's action), which may then modify the dataset accordingly.

### MP object

The gamerule has access to a special `mp: MPView` object in `onDataChange`, `methods`, and `views`. The following methods are exposed:

| MethodName       | Description                                   |
| ---------------- | --------------------------------------------- |
| `getData`        | Get the value of a (global) data              |
| `setData`        | Set the value of a (global) data              |
| `getPlayerData`  | Get the value of a client's data              |
| `getPlayersData` | Get the aggregated values of all clients data |
| `setPlayerData`  | Set the value of a client's data              |
| `setView`        | Set view for a given client                   |
| `setViewProps`   | Set the React props for the view              |
| `playersCount`   | Get the count of connected clients            |
| `playersForEach` | Enumerate through all connected client Ids    |
| `getPluginView`  | Get a view of a plugin                        |

There are also a few special keys on the `mp` object:

| KeyName  | Description    |
| -------- | -------------- |
| `hostId` | Id of the host |
| `roomId` | Id of the room |

The `mp` object is passed in as the (only) argument in `onDataChange`, and as the first argument for each methods. It is accessible in React `views` via via the view props - `this.props.MP`.

### Gamerule Plugins

Gamerules may define a plugin hierarchy so that common components can be re-used. Gamerules can access a plugin's asset (data / view) via namespace
chaining. For instance, if gamerule `toprule` has `foo` as its plugin, and `foo` has `bar` as a plugin, then `toprule` can access `bar`'s
asset via the prefix `foo_bar_*`. For instance, if `foo` has a data `foodata`, and `bar` has a view `barview`, `toprule` may access these
assets with `mp.getData('foo_foodata')` and `mp.setView(clientId, 'foo_bar_barview')` respectively.

The entire plugin hierarchy tree runs in the same manner as the root gamerule; whenever its `data` has changed, the plugin's `onDataChange` will be
invoked. Views that are set by plugins will not have effect, but its parent rule may get the view that a plugin has set via `mp.getView`. A view of the parent gamerule may also access a plugin's viewprops by chaining down the `this.props` object. For e.g, following the example above, if `bar` has a key `this.props.barprops` in its view props, the top-level gamerule `toprule` may access it via `this.props.foo.bar.barprops`.

## Message Passing in Multiplayr

Messages are sent and received via **Packets** (`PacketType`), which is a javascript object.
Each layer populates a corresponding key in the Packet and passes it down to the next layer.

### DataExchange Layer

The DataExchange layer is the layer that the gameobject talks to directly. Its primary purpose is to allow
clients to execute rule methods (via `DataExchange.execMethod`) and for the host to set views on the clients
(via `DataExchange.setView`).

It also receives notification from the session layer about room related activities (e.g when a new client joins, or
an existing client disconnects), and forwards the notification to the gameobject layer.

### Session Layer

The session layer manages the room related protocol. When a session is established, a ClientId is assigned to the session.
Through the session layer, a room can be created (in which the session becomes the host of the room), or the session can
join an existing room.

### Transport Layer

The transport layer encapsulates the mechanism in which the packet is actually sent between devices. In the default
implementation of Multiplayr, the transport layer is implemented with socket.io with nodejs backend.

#### Example

An example packet from a host gameobj setting a view on a client may look something like

```
{
    dxc: {
        action: 2, // Enum value of DataExchangeMessageType.SetView
        setViewProp: {
             displayName: 'lobby',
             props: []
        }
    },
    session: {
        action: 3, // Enum value of SessionMessageType.SendMessage
        roomId: '123456'
        toClientId: 'foo123',
        fromClientId: 'bar456'
    }
}
```

![Packet Example](/images/packet_example.png)

## Todo

1. Document the layers of multiplayr
2. Complete typing for gamerules
3. Fix reconnect logic (move clientId to session instead of transport)
4. Write Unit Tests
