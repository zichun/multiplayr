var Shell = {};

Shell.methods = {};

Shell.onDataChange = function() {
    var gameObj = this;

    this.setView(this.clientId, 'GenericGameShell');
    this.playersForEach(function(client) {
        gameObj.setView(client, 'GenericGameShell');
    });

    return true;
};

Shell.views = {
    GenericGameShell: React.createClass({
        displayName: 'GenericGameShell',
        render: function() {
            alert(this.props.MP.getSubView('bigger'));
            return this.props.MP.getSubView('bigger');
        }
    })
};

Shell.plugins = {
    "bigger": BiggerRule
};