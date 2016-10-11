var Queue = require('firebase-queue');
var firebase = require('firebase');

firebase.initializeApp({
  databaseURL: "https://loot-9909b.firebaseio.com",
  serviceAccount: './secret.json',
  databaseAuthVariableOverride: {
    uid: "lootmaster"
  }
});

var ref = firebase.database().ref('queue');

var queue = new Queue(ref, function(data, progress, resolve, reject) {
  console.log(data);

  // // Do some work
  // progress(50);
  //
  // // Finish the task asynchronously
  // setTimeout(function() {
  //   resolve();
  // }, 1000);
});

process.on('SIGINT', function() {
  console.log('Starting queue shutdown');
  queue.shutdown().then(function() {
    console.log('Finished queue shutdown');
    process.exit(0);
  });
});
