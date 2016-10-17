var firebase = require('firebase');

module.exports = {

  startGame: function(request, progress, resolve, reject, database) {
    database.ref("games/" + request.gameID).once("value", function(snapshot) {
      var updates = {};
      var game = snapshot.val();
      var teams = game.teams;

      if (teams[1] && teams[2]) {
        updates["gamePlayers/" + request.gameID] = {
          "1": teams[1],
          "2": teams[2],
        };
        updates["gameInventories/" + request.gameID] = {
          "1": teams[1],
          "2": teams[2],
        };

        updates["games/" + request.gameID + "/started"] = firebase.database.ServerValue.TIMESTAMP;
        database.ref().update(updates).then(resolve).catch(reject);
      }
      else {
        reject("No teams or bad teams");
      }

    }).catch(reject);
  },

  endGame: function(request, progress, resolve, reject, database) {
    var updates = {};

    updates["games/" + request.gameID + "/started"] = false;
    updates["gamePlayers/"     + request.gameID] = false;
    updates["gameInventories/" + request.gameID] = false;

    database.ref().update(updates).then(resolve).catch(reject);
  },

}
