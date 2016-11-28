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
      console.log("Processing", data.request.action, "for", data.request.playerID);
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

      if (player && player.location && player.location.x && player.location.y) {
        reject("Player has already spawned");
        break;
      }

      var spawnLocation = [0,0];

      updates["playerSecrets/" + request.playerID] = {
        location: {
          x: spawnLocation[0],
          y: spawnLocation[1],
        },
      };

      updates[`locations/${spawnLocation[0]}/${spawnLocation[1]}/object`] = {
        type: "player",
        playerID: request.playerID,
        previousLocation: {
          x: spawnLocation[0],
          y: spawnLocation[1],
        },
      }
      break;

    // Move
    case "move":
      var player = await getPlayer(request.playerID);

      if (!player) {
        console.log(player, "Player has not spawned?");
        reject("Player has not spawned?");
        break;
      }

      var distance = distanceBetween([player.location.x, player.location.y], [request.target.x, request.target.y]);

      if (distance > 6) {
        console.log("Distance too great");
        reject("Distance too great");
        break;
      }

      var currentLocation = await getLocation(player.location.x, player.location.y);
      var targetLocation = await getLocation(request.target.x, request.target.y);

      updates["playerSecrets/" + request.playerID] = {
        location: {
          x: request.target.x,
          y: request.target.y,
        },
      };

      updates[`locations/${player.location.x}/${player.location.y}/object`] = false;

      updates[`locations/${request.target.x}/${request.target.y}/object`] = {
        type: "player",
        playerID: request.playerID,
        previousLocation: {
          x: player.location.x,
          y: player.location.y,
        },
      }
      break;

    // Reject
    default:
      reject("Unknown action");
  }

  if (Object.keys(updates).length > 0) {
    console.log("Successfully processed");
    return database.ref().update(updates).then(resolve).catch(reject);
  }
  else {
    console.log("No updates to make");
    return reject("No updates to make");
  }
}

// Fetching functions
var getPlayer = function(playerID) {
  return database.ref("playerSecrets/" + playerID).once("value").then(function(snapshot) {
    return snapshot.val();
  });
}

var getLocation = function(x, y) {
  return database.ref("locations/" + x + "/" + y).once("value").then(function(snapshot) {
    return snapshot.val();
  });
}

// Utility functions
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
