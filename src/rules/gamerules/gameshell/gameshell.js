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
    "HostShell-Main": React.createClass({
        render: function() {
            var header = Shell.views["HostShell-Main-Head"](this.props);
            var body = Shell.views["HostShell-Main-Body"](this.props);

            return React.DOM.div({id: "shell-main"},
                                 header,
                                 body);
        }
    }),

    "HostShell-Main-Head": React.createClass({
        render: function() {
            return React.DOM.div({id: 'shell-header'},
                                 React.DOM.div({id: 'shell-room'},
                                               this.props.MP.roomId));
        }
    }),

    "HostShell-Main-Body": React.createClass({
        getInitialState: function() {
            return {currentView: 'home'};
        },
        setView: function(newView) {
            this.state.currentView = newView;
            $("#shell-nav-trigger").attr('checked',false);
            this.forceUpdate();
        },
        render: function() {
            var hamburgerMenus = Shell.views["HostShell-Main-Body-Menu"]({
                links: this.props.links,
                setView: this.setView
            });

            var content = React.DOM.div({ id: "shell-main-content" },
                                        this.props['view-' + this.state.currentView.toLowerCase()]);

            return React.DOM.div({id: 'shell-body'},
                                 hamburgerMenus,
                                 React.DOM.input({ type:"checkbox", id:"shell-nav-trigger", className:"shell-nav-trigger" }),
                                 React.DOM.label({ htmlFor:"shell-nav-trigger" }),
                                 content);
        }
    }),

    "HostShell-Main-Body-Menu": React.createClass({
        setView: function(e) {
            this.props.setView(e.target.innerText);
        },
        render: function() {
            var tr = [React.DOM.li({onClick: this.setView}, 'Home')];
            for (var i=0;i<this.props['links'].length;++i) {
                tr.push(React.DOM.li({onClick: this.setView}, this.props['links'][i]));
            }
            return React.DOM.ul({ className: 'shell-navigation' },
                                tr);
        }
    }),

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
                                 React.DOM.div({id: 'shell-container'},
                                               content));
        }
    }),

    Proxy: React.createClass({
        render: function() {
            return this.props.MP.getPluginSetView('child');
        }
    })
};

Shell.plugins = {
};