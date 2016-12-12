const Queue = require("firebase-queue");
const firebase = require("firebase-admin");

const serviceAccount = require("./secret.json");

//
// Setup connection

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://world-15e5d.firebaseio.com",
  databaseAuthVariableOverride: { worldmaster: true },
});

const database = firebase.database();

//
// Task processing

const prepareRequest = function(data, progress, resolve, reject) {
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

const processRequest = async function(request, progress, resolve, reject) {
  let updates = {};

  switch (request.action) {

    // Spawn
    case "spawn":
      const player = await fetchPlayer(request.playerID);
      if (player) {
        error("Player has already spawned", request.playerID, updates, reject);
        break;
      }


      let spawnFound = false;
      let spawnLocation;

      while (!spawnFound) {
        spawnLocation = [
          Math.floor(Math.random() * 20) - 10,
          Math.floor(Math.random() * 20) - 10,
        ];

        if (await !fetchLocation(spawnLocation[0], spawnLocation[1]).tileOwner) {
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

      const location = `locations/${spawnLocation[0]}/${spawnLocation[1]}`;

      updates[`${location}/tileOwner`] = request.playerID;
      updates[`${location}/unit`] = "tower";
      updates[`${location}/unitOwner`] = request.playerID;
      updates[`${location}/unitLastX`] = null;
      updates[`${location}/unitLastY`] = null;
      updates[`${location}/unitLastTurn`] = 0;
      updates[`${location}/unitLastAction`] = "spawn";

      break;

    // Move
    case "move":
      //
      // Preliminary checks

      // Is the distance short enough?
      const distance = distanceBetween([request.origin.x, request.origin.y], [request.target.x, request.target.y]);

      if (distance > 1.5) {
        error("Distance too great", request.playerID, updates, reject);
        break;
      }

      //
      // Check origin and target

      const [origin, target] = await Promise.all([
        fetchLocation(request.origin.x, request.origin.y),
        fetchLocation(request.target.x, request.target.y)
      ]);


      // Does origin contain your unit?
      if (origin.unitOwner !== request.playerID) {
        error("Can't move units you don't own", request.playerID, updates, reject);
        break;
      }

      //
      // Try to perform the action on target

      const target = referenceLocation(request.target.x, request.target.y);
      let oldTargetValue;

      let targetTransaction = await target.transaction(async function(targetValue) {
        // Save first target value
        if (!oldTargetValue) {
          oldTargetValue = targetValue;
        }

        // Is target occupied?
        if (targetValue.unit) {
          error("Can't move onto another unit", request.playerID, updates, reject);
          return;
        }

        else {
          targetValue.tileOwner = request.playerID;
          targetValue.unit = fetchedOrigin.unit;
          targetValue.unitOwner = fetchedOrigin.unitOwner;
          targetValue.unitLastX = request.origin.x;
          targetValue.unitLastY = request.origin.y;
          targetValue.unitLastTurn = fetchedOrigin.unitLastTurn;
          targetValue.unitLastAction = "move";

          return targetValue;
        }
      });

      if (!targetTransaction.committed) {
        error("Action on the target failed", request.playerID, updates, reject);
        break;
      }

      //
      // Try to inflict the consequences on origin

      const origin = referenceLocation(request.origin.x, request.origin.y);
      const newTargetValue = targetTransaction.snapshot;

      let originTransaction = await origin.transaction((originValue) => {
        originValue.unit = null;
        originValue.unitOwner = null;
        originValue.unitLastX = null;
        originValue.unitLastY = null;
        originValue.unitLastTurn = null;
        originValue.unitLastAction = null;

        return originValue;
      });

      //
      // Update indexes

      updates[`playerSecrets/${request.playerID}/locations/${request.target.x}/${request.target.y}`] = true;

      if (oldTargetValue.tileOwner) {
        updates[`playerSecrets/${target.tileOwner}/locations/${request.target.x}/${request.target.y}`] = null;
      }

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
    reject("No updates to make");
  }
}

//
// Helper functions

const fetchPlayer = function(playerID) {
  return database.ref(`playerSecrets/${playerID}`).once("value").then(function(snapshot) {
    return snapshot.val();
  });
}

const fetchLocation = function(x, y) {
  return database.ref(`locations/${x}/${y}`).once("value").then(function(snapshot) {
    return snapshot.val();
  });
}

const referenceLocation = function(x, y) {
  return database.ref(`locations/${x}/${y}`);
}

const error = function(message, playerID, reject) {
  console.log(playerID, message);
  let updates = {};
  updates[`playerSecrets/${playerID}/message`] = message;
  return database.ref().update(updates).then(reject).catch(reject);
}

const distanceBetween = function(origin, target) {
  return (
    Math.abs(
      Math.sqrt(
          Math.pow(origin[0] - target[0], 2)
        + Math.pow(origin[1] - target[1], 2)
      )
    )
  );
}

//
// Queue starting

const actionQueue = new Queue(
  database.ref("actionQueue"),
  {"numWorkers": 5},
  prepareRequest
);

console.log("Queue started");

//
// Queue ending

process.on("SIGINT", function() {
  console.log("Starting queue shutdown");

  actionqueue.shutdown()
  .then(function() {
    console.log("Finished queue shutdown");
    process.exit(0);
  });
});
