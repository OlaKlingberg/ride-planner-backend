const _ = require("lodash");

const { User } = require('./models/user');
const { Ride } = require('./models/ride');
const { RiderService } = require('./utils/rider-service');
const { UserService } = require('./utils/user-service');

const https = require('https');

let dummyRiders = []; // Todo: Move this to rider-service, for the sake of consistency?
let latInc = null;
let latSign = null;
let lngInc = null;
let lngSign = null;

/**
 * Todo: This file contains a lot of code that only pertains to the demo use of the app. It would be nice if I could
 * separate that code from that which pertains to live use.
 *
 * Todo: I pass socket, io, and other stuff from function to function. Wouldn't it be better to set these variables
 * globally in the file instead?
 */

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
      console.log("connection. socket.id:", socket.id, new Date().toString());

      socket.emit('socketConnection', socket.id);

      // AddConnectedLoggedInUser
      socket.on('AddConnectedLoggedInUser', email => {
        UserService.addConnectedLoggedInUser(email, socket.id);
      });

      // addDummyRiders
      socket.on('addDummyRiders', (user, token, callback) => {
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {
          console.log("addDummyRiders");

          this.snapToRoad(user.position, callback)
            .then(snappedPosition => {
              // Call a RiderService function that returns five dummy users from the db.
              User.getDummyUsers(dummyRiders.length, 5).then(dummies => {
                // Todo: The way I handle the situation if there are too few users is kind of ugly (but it works).
                if ( dummies.length < 5 ) {
                  User.addDummyMembers()
                    .then(() => {
                      this.setDummyRiderCoords(socket, io, user.ride, snappedPosition, dummies, callback);
                    });
                }

                this.setDummyRiderCoords(socket, io, user.ride, snappedPosition, dummies, callback);
              });
            });

        }).catch(err => {
          console.log("The user was not found! err:", err); // Todo: Handle error.
        });
      });

      // debugging
      socket.on('debugging', message => {
        console.log("debugging", message);
        io.in('admins').emit('debugging', message);
      });


      // giveMeAvailableRides
      socket.on('giveMeAvailableRides', () => {
        console.log("socket.on('giveMeAvailableRides')");

        // Todo: I could use a callback instead of emitting this!
        Ride.getRides().then(rides => {
          socket.emit('availableRides', rides);
        });
      });


      // giveMeConnectedLoggedInUsers
      socket.on('giveMeConnectedLoggedInUsers', (callback) => {
        callback(UserService.getConnectedLoggedInUsers());
      });


      // giveMeRiderList
      socket.on('giveMeRiderList', ride => {
        this.onGiveMeRiderList(socket.id, socket, ride)
      });


      // joinRide
      socket.on('joinRide', (user, ride, token, callback) => {
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {

          this.onJoinedRide(user, ride, callback, socket.id, socket, io);

        }).catch(err => {
          console.log("The user was not found! err:", err); // Todo: Handle error.
        });
      });


      // leaveRide
      socket.on('leaveRide', () => {
        this.onLeaveRide(socket.id, socket, io);
      });

      // RemoveConnectedLoggedInUser
      socket.on('RemoveConnectedLoggedInUser', email => {
        UserService.removeConnectedLoggedInUser(socket.id);
      });

      // removeDummyRiders
      socket.on('removeDummyRiders', (ride) => {
        dummyRiders.forEach(dummy => {
          clearInterval(dummy.timer);
          let rider = RiderService.getRider(dummy.fauxSocketId);
          this.onLeaveRide(dummy.fauxSocketId, socket, io);
          io.in(ride).emit('removedRider', rider._id);
        });

        dummyRiders = [];
        latSign = null;
        socket.leave(ride);
      });


      // updateUserPosition
      socket.on('updateUserPosition', position => {
        this.onUpdateUserPosition(socket.id, position, io);
      });


      // disconnect
      socket.on('disconnect', () => {
        console.log("disconnect:", socket.id);

        UserService.removeConnectedLoggedInUser(socket.id);

        let rider = RiderService.getRider(socket.id);

        if ( rider ) {
          console.log('Disconnected rider:', rider.fname, rider.lname);
          RiderService.markAsDisconnected(rider);
          socket.leave(rider.ride);
          // Delay, to minimize the risk that riderList and disconnectedRider are received in the wrong order.
          setTimeout(() => {
            socket.in(rider.ride).emit('disconnectedRider', _.pick(rider, '_id', 'disconnected'));
          }, 200);
        }
      });

    });
  }

  onGiveMeRiderList(socketId, socket, ride) {
    let requestingRider = RiderService.getRider(socketId);
    if ( !requestingRider ) console.log("The requesting rider was not found in riderList");
    if ( requestingRider ) {
      // requestingRider.leader);
      if ( requestingRider.leader || requestingRider.admin ) {
        // RiderService.getRiderList(ride));
        socket.emit('riderList', RiderService.getRiderList(ride));
      } else {
        socket.emit('riderList', RiderService.getPublicRiderList(ride));
      }
    }
  }

  onJoinedRide(user, ride, callback, socketId, socket, io) {
    console.log("onJoinedRide. user:", user.fname, user.lname, user.fauxSocketId);

    socket.join(ride);
    if ( user.admin ) socket.join('admins');

    // Emits public info about the joinedRider to everybody on the ride.
    let rider = RiderService.addRider(user, ride, socketId);

    if ( rider.leader ) {
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone', 'dummy'))
    } else {
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'dummy'))
    }

    // Emits all info about the joinedRider to ride leaders on the ride.
    // Todo: What happens if this arrives before the message emitted above?
    let rideLeaders = RiderService.getRideLeaders(rider.ride);
    rideLeaders.forEach(leader => {
      // JSON.stringify(rider.position.coords.latitude));

      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'dummy'));
      // io.in(rider.ride).emit('joinedRider', rider); // Todo: Why does this sent "latitude: undefined"?
    });

    callback();
  }

  onLeaveRide(socketId, socket, io) {
    let rider = RiderService.getRider(socketId);
    if ( rider ) {  // Safety precaution.
      console.log("onleaveRide(). ride:", rider.ride, "rider:", rider.fname, rider.lname, rider._id);
      RiderService.removeRider(rider);
      io.to(rider.ride).emit('removedRider', _.pick(rider, '_id')._id.toString()); // _id is a mongoDB ObjectId.
    }
  }

  onUpdateUserPosition(socketId, position, io) {
    // console.log("onUpdateUserPosition. socketId:", socketId);
    let rider = RiderService.updateRiderPosition(socketId, position);
    if ( rider ) {
      setTimeout(() => {
        io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
      }, 200);
    }
  }

  snapToRoad(position, callback) {
    console.log("snapToRoad(position) position:", position, "GOOGLE_MAPS_KEY:", process.env.GOOGLE_MAPS_KEY);
    return new Promise((resolve, reject) => {

      callback("About to send a request to roads.googleapis.com with key:", process.env.GOOGLE_MAPS_KEY);

      https.get(`https://roads.googleapis.com/v1/snapToRoads?path=${position.coords.latitude},${position.coords.longitude}&key=${process.env.GOOGLE_MAPS_KEY}`, (res) => {
        const statusCode = res.statusCode;
        const contentType = res.headers['content-type'];

        let error;
        if ( statusCode !== 200 ) {
          error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if ( !/^application\/json/.test(contentType) ) {
          error = new Error('Invalid content-type.\n' +
            `Expected application/json but received ${contentType}`);
        }
        if ( error ) {
          console.log(error.message);
          callback(error.message);
          // consume response data to free up memory
          res.resume();
          return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            const snappedPoint = parsedData.snappedPoints[0].location;

            resolve({ coords: snappedPoint });
          } catch ( e ) {
            console.log(e.message);
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`);
      });
    });
  }

  setDummyRiderCoords(socket, io, ride, snappedPosition, dummies, callback) {
    if ( latSign === null ) {
      latSign = Math.sign(Math.random() - .5);
      lngSign = Math.sign(Math.random() - .5);

      latInc = Math.random() * .00012;
      lngInc = Math.random() * .00012;
      if ( latInc < .00008 && lngInc < .00008 ) {
        latInc += .00004;
        lngInc += .00004;
      }

      latInc *= latSign;
      lngInc *= lngSign;

      console.log("latInc:", latInc);
      console.log("lngInc:", lngInc);
    }

    dummies.forEach(dummy => {
      if ( dummy.timer ) clearInterval(dummy.timer);

      const stepSize = Math.random() * .2 + 1;
      this.setDummyRiderCoordsIntervalTimer(socket, io, ride, snappedPosition, dummy, latInc * stepSize, lngInc * stepSize);
    });

    callback();
  }

  setDummyRiderCoordsIntervalTimer(socket, io, ride, snappedPosition, dummy, latInc, lngInc) {
    let prevSnappedLat = null;
    let prevSnappedLng = null;
    let flipLatInc = true;
    dummy.position = {
      coords: {
        latitude: snappedPosition.coords.latitude + Math.random() * .00006 - .00003,
        longitude: snappedPosition.coords.longitude + Math.random() * .00006 - .00003
      }
    };
    dummy.fauxSocketId = dummyRiders.length;
    // dummy.creatorsSocketId = socket.id;

    this.onJoinedRide(dummy, ride, () => {
    }, dummy.fauxSocketId, socket, io);
    dummy.timer = setInterval(() => {
      dummy.position.coords.latitude += latInc;
      dummy.position.coords.longitude += lngInc;

      this.snapToRoad(dummy.position)
        .then(snappedPosition => {
          if ( prevSnappedLat &&
            Math.abs(prevSnappedLat - snappedPosition.coords.latitude) < .00007 &&
            Math.abs(prevSnappedLng - snappedPosition.coords.longitude) < .00007 ) {
            flipLatInc ? latInc *= -1.1 : lngInc *= -1.1;
            flipLatInc = !flipLatInc;
          }

          prevSnappedLat = snappedPosition.coords.latitude;
          prevSnappedLng = snappedPosition.coords.longitude;

          this.onUpdateUserPosition(dummy.fauxSocketId, snappedPosition, io, true)
        })
        .catch(e => {
            console.log("onUpdateUserPosition napToRoad.catch(e)", e); // Todo: Do I need any error handling here?
          }
        );
    }, Math.random() * 1000 + 1500);
    dummyRiders.push(dummy);

    setTimeout(() => {
      clearInterval(dummy.timer);
      io.to(dummy.ride).emit('removedRider', _.pick(dummy, '_id')._id.toString()); // _id is a mongoDB ObjectId.
      dummyRiders = dummyRiders.filter(dummyRider => dummyRider._id !== dummy._id);
      console.log("dummyRiders.length:", dummyRiders.length);
    }, 300000);

  }


}

module.exports = { SocketServer };
