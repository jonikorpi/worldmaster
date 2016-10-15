var Queue = require('firebase-queue');
var firebase = require('firebase');

var actions = require('./actions');

firebase.initializeApp({
  databaseURL: "https://loot-9909b.firebaseio.com",
  serviceAccount: './secret.json',
  databaseAuthVariableOverride: { lootmaster: true },
});

var database = firebase.database();

var actionQueue = new Queue(database.ref("actionQueue"), function(data, progress, resolve, reject) {
  var request = data.request;
  console.log(request.action, "for", request.playerID, "in", request.gameID);

  if (request) {
    switch (request.action) {
      default:
        reject("Unknown action");
    }
  }
  else {
    reject("Missing request or request attributes");
  }
});

var gameQueue = new Queue(database.ref("gameQueue"), function(data, progress, resolve, reject) {
  var request = data.request;
  console.log(request.action, "for", request.playerID, "in", request.gameID);

  if (request) {
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

process.on("SIGINT", function() {
  console.log("Starting queue shutdowns");

  actionQueue.shutdown().then(gameQueue.shutdown()).then(function() {
    console.log("Finished queue shutdowns");
    process.exit(0);
  });
});
