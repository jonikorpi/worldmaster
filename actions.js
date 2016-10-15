module.exports = {

  startGame: function(request, progress, resolve, reject, database) {
    database.ref("games/" + request.gameID).update({
      started: true,
    });

    resolve();
  },

  endGame: function(request, progress, resolve, reject, database) {
    database.ref("games/" + request.gameID).update({
      started: false,
    });

    resolve();
  },

}
