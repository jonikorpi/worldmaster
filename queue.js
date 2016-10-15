var Queue = require('firebase-queue');
var firebase = require('firebase');

var actions = require('./actions');

firebase.initializeApp({
  databaseURL: "https://loot-9909b.firebaseio.com",
  serviceAccount: './secret.json',
  databaseAuthVariableOverride: { lootmaster: true },
});

var database = firebase.database();
var queue = database.ref('queue');

var queueHandler = new Queue(queue, function(data, progress, resolve, reject) {

  var request = data.request;

  console.log("Processing ", request.action, " for ", request.playerID, " in ", request.gameID);

  if (
      request
      && typeof request.playerID === "string"
      && typeof request.gameID   === "string"
      && typeof request.action   === "string"
  ) {
    switch (request.action) {
      case "startGame":
        actions.startGame(request, progress, resolve, reject, database);
        break;
      case "endGame":
        actions.endGame(request, progress, resolve, reject, database);
        break;
      default:
        reject("Unknown action");
    }
  }
  else {
    reject("Missing request or request attributes");
  }

});

process.on('SIGINT', function() {
  console.log('Starting queue shutdown');
  queueHandler.shutdown().then(function() {
    console.log('Finished queue shutdown');
    process.exit(0);
  });
});
