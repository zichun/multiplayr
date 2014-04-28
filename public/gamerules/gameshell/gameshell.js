var Shell = {};

Shell.methods = {};

Shell.name = "gameshell";
Shell.css = ['shell.css'];

Shell.onDataChange = function() {
    var gameObj = this;

    this.setView(this.clientId, 'HostShell');

    this.playersForEach(function(client) {
        gameObj.setView(client, 'Proxy');
    });

    return true;
};

Shell.views = {
    HostShell: React.createClass({
        displayName: 'HostShell',
        render: function() {

            var header = React.DOM.div(
                {id: 'shell-header'},
                React.DOM.div({id: 'shell-room'},
                              this.props.MP.roomId));

            var content = Shell.views.Proxy(this.props);

            return React.DOM.div(null,
                                 header,
                                 content);
        }
    }),

    Proxy: React.createClass({
        render: function() {
            return this.props.MP.getSubView('child');
        }
    })
};

Shell.plugins = {
    "child": null
};