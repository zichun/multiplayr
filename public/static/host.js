$(function() {
    for (var rule in _MPRules) {
        if (!_MPRules.hasOwnProperty(rule)) continue;


        $('#rules').append(makeRule(rule, _MPRules[rule]));
    }

    function makeRule(name, rule) {
        var $rule = $('<div class="rule" />');

        $('<header class="name">' + name + '</header>').appendTo($rule);
        $('<div class="desc">' + rule.description + '</div>').appendTo($rule);
        $('<button class="host">Host this game!</button>')
            .click(JoinGame(name))
            .appendTo($rule);
        return $rule;
    }

    function JoinGame(ruleName) {
        return function() {
            $("#rules").empty();
            var commHost = new MPProtocol(io, location.protocol + '//' + location.host, document.body);
            commHost.create(ruleName);
        };
    }


});