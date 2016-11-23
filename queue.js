var Queue = require("firebase-queue");
var firebase = require("firebase-admin");

var serviceAccount = require("./secret.json");

// Setup connection
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://world-15e5d.firebaseio.com",
  databaseAuthVariableOverride: { worldmaster: true },
});
var database = firebase.database();

// Terminate nicely
process.on("SIGINT", function() {
  console.log("Starting queue shutdowns");

  playerQueue.shutdown().then(actionQueue.shutdown()).then(function() {
    console.log("Finished queue shutdowns");
    process.exit(0);
  });
});

// Player queue
var playerQueue = new Queue(database.ref("playerQueue"), {"numWorkers": 5}, function(data, progress, resolve, reject) {
  var request = data.request;
  console.log("playerQueue:", request.action, "for", request.playerID);

  if (request) {
    var updates = {};

    switch (request.action) {

      case "spawn":
        database.ref("playerSecrets/" + request.playerID).once("value", function(snapshot) {
          var player = snapshot.val();

          if (player && player.location && player.location.x && player.location.y) {
            reject("Player has already spawned");
          }

          var spawnLocation = [0,0];

          updates["playerSecrets/" + request.playerID] = {
            location: {
              x: spawnLocation[0],
              y: spawnLocation[1],
            },
          };

          updates["locations/0/0/0/object"] = {
            type: "player",
            playerID: request.playerID,
            previousLocation: {
              x: spawnLocation[0],
              y: spawnLocation[1],
            },
          }

          database.ref().update(updates).then(resolve).catch(reject);
        }).catch(reject);
        break;

      default:
        reject("Unknown action");

    }
  }
  else {
    reject("Missing request or request attributes");
  }
});

// Game queue
var actionQueue = new Queue(database.ref("actionQueue"), {"numWorkers": 5}, function(data, progress, resolve, reject) {
  var request = data.request;
  console.log("actionQueue:", request.action, "for", request.playerID, "in");

  if (request) {
    var updates = {};

    switch (request.action) {
      default:
        reject("Unknown action");
    }
  }
  else {
    reject("Missing request or request attributes");
  }
});
