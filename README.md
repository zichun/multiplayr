Multiplayr
==========

A platform for creating games where your devices (smartphones / tablets) host the game assets.

Building and running
--------------------

```
npm install
gulp
node build\app
```

Rules Definition
-----------------

(todo) document how game rules are defined

Game Management (gameobj)
----------------------------

(todo) document GameObject class

Message Passing in Multiplayr
--------------------------------

Messages are sent and received via **Packets** (```PacketType```), which is a javascript object.
Each layer populates a corresponding key in the Packet and passes it down to the next layer.

### DataExchange Layer

The DataExchange layer is the layer that the gameobject talks to directly. Its primary purpose is to allow
clients to execute rule methods (via ```DataExchange.execMethod```) and for the host to set views on the clients
(via ```DataExchange.setView```).

It also receives notification from the session layer about room related activities (e.g when a new client joins, or
an existing client disconnects), and forwards the notification to the gameobject layer.

### Session Layer

The session layer manages the room related protocol. When a session is established, a ClientId is assigned to the session.
Through the session layer, a room can be created (in which the session becomes the host of the room), or the session can
join an existing room.

### Transport Layer

The transport layer encapsulates the mechanism in which the packet is actually sent between devices. In the default
implementation of Multiplayr, the transport layer is implemented with socket.io with nodejs backend.

### Example

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

Todo
----

1. Document the layers of multiplayr
2. Complete typing for gamerules
3. Fix reconnect logic (move clientId to session instead of transport)
4. Write Unit Tests
