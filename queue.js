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

// Functions
var prepareRequest = function(data, progress, resolve, reject) {
  try {
    if (data.request) {
      console.log("Processing", data.request);
      processRequest(data.request, progress, resolve, reject);
    }
    else {
      console.log("Rejecting", data.request.action, "for", data.request.playerID);
      reject("Missing request");
    }
  }
  catch (error) {
    console.log(error);
  }
}

var processRequest = async function(request, progress, resolve, reject) {
  var updates = {};

  switch (request.action) {

    // Spawn
    case "spawn":
      var player = await getPlayer(request.playerID);
      if (player) {
        error("Player has already spawned", request.playerID, updates, reject);
        break;
      }


      var spawnFound = false;
      var spawnLocation;

      while (!spawnFound) {
        spawnLocation = [
          Math.floor(Math.random() * 20) - 10,
          Math.floor(Math.random() * 20) - 10,
        ];

        if (await !getLocation(spawnLocation[0], spawnLocation[1]).tileOwner) {
          spawnFound = true;
        }
      }

      updates[`playerSecrets/${request.playerID}`] = {
        "message": "Successfully spawned",
        "turn": 1,
        locations: {
          [spawnLocation[0]]: {
            [spawnLocation[1]]: true
          }
        },
      };

      var location = `locations/${spawnLocation[0]}/${spawnLocation[1]}`;

      updates[`${location}/tileOwner`] = request.playerID;
      updates[`${location}/unit`] = "tower";
      updates[`${location}/unitOwner`] = request.playerID;
      updates[`${location}/unitLastX`] = null;
      updates[`${location}/unitLastY`] = null;
      updates[`${location}/unitLastTurn`] = 0;

      break;

    // Move
    case "move":
      var player = await getPlayer(request.playerID);

      if (!player) {
        error("Player has not spawned?", request.playerID, updates, reject);
        break;
      }

      var distance = distanceBetween([player.x, player.y], [request.target.x, request.target.y]);

      if (distance > 6) {
        error("Distance too great", request.playerID, updates, reject);
        break;
      }

      var currentLocation = await getLocation(player.x, player.y);
      var targetLocation = await getLocation(request.target.x, request.target.y);

      updates[`playerSecrets/${request.playerID}/x`] = request.target.x;
      updates[`playerSecrets/${request.playerID}/y`] = request.target.y;
      updates[`locations/${player.x}/${player.y}/objectID`] = null;
      updates[`locations/${request.target.x}/${request.target.y}/objectID`] = request.playerID;
      updates[`playerSecrets/${request.playerID}/message`] = "Successfully moved";

      break;

    // Reject
    default:
      error("Unknown action", request.playerID, updates, reject);
  }

  if (Object.keys(updates).length > 0) {
    console.log("Successfully processed");
    return database.ref().update(updates).then(resolve).catch(reject);
  }
  else {
    reject("No valid updates to make");
  }
}

// Fetching functions
var getPlayer = function(playerID) {
  return database.ref(`playerSecrets/${playerID}`).once("value").then(function(snapshot) {
    return snapshot.val();
  });
}

var getLocation = function(x, y) {
  return database.ref(`locations/${x}/${y}`).once("value").then(function(snapshot) {
    return snapshot.val();
  });
}

// Utility functions
var error = function(message, playerID, reject) {
  console.log(playerID, message);
  var updates = {};
  updates[`playerSecrets/${playerID}/message`] = message;
  return database.ref().update(updates).then(reject).catch(reject);
}

var distanceBetween = function(origin, target) {
  return (
    Math.abs(
      Math.sqrt(
          Math.pow(origin[0] - target[0], 2)
        + Math.pow(origin[1] - target[1], 2)
      )
    )
  );
}

// Start player queue
var playerQueue = new Queue(
  database.ref("playerQueue"),
  {"numWorkers": 5},
  prepareRequest
);

// Start game queue
var actionQueue = new Queue(
  database.ref("actionQueue"),
  {"numWorkers": 5},
  prepareRequest
);

// Terminate nicely
process.on("SIGINT", function() {
  console.log("Starting queue shutdowns");

  playerQueue.shutdown()
  .then(actionQueue.shutdown())
  .then(function() {
    console.log("Finished queue shutdowns");
    process.exit(0);
  });
});

console.log("Queues started");
