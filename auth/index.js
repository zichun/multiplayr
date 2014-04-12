function init(everyauth) {
    var usersById = {};
    var nextUserId = 0;
    var usersByAzureAcs = {};

    function addUser (source, sourceUser) {
        var user = usersById[++nextUserId] = {id: nextUserId};
        user[source] = sourceUser;
        return user;
    }

    everyauth.azureacs
             .identityProviderUrl('https://multiplayr.accesscontrol.windows.net/v2/wsfederation/')
             .entryPath('/auth/azureacs')
             .callbackPath('/auth/azureacs/callback')
             .signingKey('kUoWLuA9PlY1Go/DvWVQuTyCBimDqz3sDNGlcwP4i3c=')
             .realm('http://localhost:3000/')
             .homeRealm('') // if you want to use a default idp (like google/liveid)
             .tokenFormat('swt')  // only swt supported for now
             .findOrCreateUser( function (session, acsUser) {
                 return usersByAzureAcs[acsUser.id] || (usersByAzureAcs[acsUser.id] = addUser('azureAcs', acsUser));
             })
             .redirectPath('/');
}

module.exports = {
    init: init
};