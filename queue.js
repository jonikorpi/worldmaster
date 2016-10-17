var Queue = require("firebase-queue");
var firebase = require("firebase");

var actions = require("./actions");
var utils = require("./utils");

// Setup connection
firebase.initializeApp({
  databaseURL: "https://loot-9909b.firebaseio.com",
  serviceAccount: './secret.json',
  databaseAuthVariableOverride: { lootmaster: true },
});
var database = firebase.database();

// Setup presence
var presence = database.ref("lootmasters").push(true);
presence.onDisconnect().remove();

// Action queue
var actionQueue = new Queue(database.ref("actionQueue"), {"numWorkers": 5}, function(data, progress, resolve, reject) {
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

// Game queue
var gameQueue = new Queue(database.ref("gameQueue"), {"numWorkers": 5}, function(data, progress, resolve, reject) {
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

// Terminate nicely
process.on("SIGINT", function() {
  console.log("Starting queue shutdowns");

  actionQueue.shutdown().then(gameQueue.shutdown()).then(function() {
    console.log("Finished queue shutdowns");
    process.exit(0);
  });
});
