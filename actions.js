module.exports = {

  startGame: function(request, progress, resolve, reject, database) {
    var updates = {};

    updates["games/"           + request.gameID] = { started: true };
    updates["gamePlayers/"     + request.gameID] = true;
    updates["gameInventories/" + request.gameID] = true;
    updates["gameStatuses/"    + request.gameID] = true;

    database.ref().update(updates).then(resolve).catch(reject);
  },

  endGame: function(request, progress, resolve, reject, database) {
    var updates = {};

    updates["games/"           + request.gameID] = { started: false };
    updates["gamePlayers/"     + request.gameID] = false;
    updates["gameInventories/" + request.gameID] = false;
    updates["gameStatuses/"    + request.gameID] = false;

    database.ref().update(updates).then(resolve).catch(reject);
  },

}
