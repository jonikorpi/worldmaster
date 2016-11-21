var Queue = require("firebase-queue");
var firebase = require("firebase-admin");

var serviceAccount = require("./secret.json");
var actions = require("./actions");

// Setup connection
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://world-15e5d.firebaseio.com",
  databaseAuthVariableOverride: { worldmaster: true },
});
var database = firebase.database();

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
