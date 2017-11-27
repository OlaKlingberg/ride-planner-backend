const _ = require("lodash");

const { User } = require('./models/user');
const { Ride } = require('./models/ride');
const { RiderService } = require('./utils/rider-service');
const { UserService } = require('./utils/user-service');

const https = require('https');

let dummyRiders = []; // Todo: Move this to rider-service, for the sake of consistency?

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
      let steps;

      socket.emit('socketConnection', socket.id);

      // AddConnectedLoggedInUser
      socket.on('addConnectedLoggedInUser', email => {
        UserService.addConnectedLoggedInUser(email, socket.id);
      });

      // addDummyRiders
      socket.on('addDummyRiders', (user, token, callback) => {
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {
          console.log("1. Verified token.");

          let userLat = user.position.coords.latitude;
          let userLng = user.position.coords.longitude;

          let stepsPromise = this.getSteps(steps, userLat, userLng);
          let dummyRidersPromise = this.getDummyRiders();

          return Promise.all([stepsPromise, dummyRidersPromise])
            .then(values => {
              console.log("301. We have dummy riders, and we have steps!");
              steps = values[0];
              let dummies = values[1];
              steps.forEach(step => console.log(step.end_location));

              dummies.forEach(dummy => {
                console.log(dummy.fname, dummy.lname);
                dummy.fauxSocketId = dummyRiders.length;

                dummy.position = JSON.parse(JSON.stringify(user.position));

                this.onJoinedRide(io, socket, dummy, user.ride, dummy.fauxSocketId);
                dummyRiders.push(dummy);

                // Delay, to lessen the risk that socket messages will arrive in the wrong order.
                setTimeout(() => {
                  this.setDummyRidersCoordsInterval(io, dummy, steps);
                }, 200);
              });


            }).catch(err => {
              console.log("Promise.all.catch() ++++++++++++++++++++++++", err);
              callback(err);
            });
        }).catch(err => {
          console.log("User.findToken.catch() =====================================");
          console.log("err:", err, err.message)
          console.log("Err:", err); // Todo: Handle error.
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
        User.findByToken(token)
          .then(() => {
            this.onJoinedRide(io, socket, user, ride, socket.id);
          })
          .then(() => {
            callback();
          })
          .catch(err => {
            console.log("The user was not found! err:", err); // Todo: Handle error.
          });
      });

      // leaveRide
      socket.on('leaveRide', () => {
        this.onLeaveRide(io, socket.id);
      });

      // RemoveConnectedLoggedInUser
      socket.on('removeConnectedLoggedInUser', email => {
        UserService.removeConnectedLoggedInUser(socket.id);
      });

      // removeDummyRiders
      socket.on('removeDummyRiders', ride => {
        console.log('removeDummyRiders');
        // console.log("steps.length:", steps.length);
        steps = null;
        dummyRiders.forEach(dummy => {
          clearInterval(dummy.intervalTimer);
          let rider = RiderService.getRider(dummy.fauxSocketId);
          this.onLeaveRide(io, dummy.fauxSocketId);
          io.in(ride).emit('removedRider', rider._id);
        });

        dummyRiders = [];
        socket.leave(ride);
      });

      // updateUserPosition
      socket.on('updateUserPosition', position => {
        this.onUpdateUserPosition(io, socket.id, position);
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

  addDummyRiders() {
    console.log("205. addDummyRiders()");
    return User.getDummyUsers(dummyRiders.length, 5)
      .then(dummies => {
        console.log(`206. Just created dummyRiders`);
        return dummies;
      });
  }

  checkSupplyOfDummyMembers() {
    console.log("202. checkSupplyOfDummyMembers()");
    return User.count({ dummy: true });
  }

  degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  distanceBetweenCoords(lat1, lng1, lat2, lng2) {
    const earthRadius = 6371000;

    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lng2 - lng1);

    lat1 = this.degreesToRadians(lat1);
    lat2 = this.degreesToRadians(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }

  findNearbyPlace(lat, lng) {
    console.log("107. findNearbyPlace()");
    return new Promise((resolve, reject) => {

      https.get(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=400&key=${process.env.GOOGLE_MAPS_KEY}`, (res) => {
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

            const placeLat = parsedData.results[0].geometry.location.lat;
            const placeLng = parsedData.results[0].geometry.location.lng;

            resolve({ placeLat, placeLng });
          } catch ( e ) {
            console.log("findNearbyPlace. in the try-catch clause: e.message:", e.message);
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`);
      });
    });
  }

  generateRandomPosition(lat, lng) {
    console.log("105. generateRandomPosition()");
    let randomLat;
    let randomLng;
    let dist = 0;

    while ( dist < 7000 ) {
      randomLat = lat + Math.random() * .2 - .1;
      randomLng = lng + Math.random() * .2 - .1;

      dist = this.distanceBetweenCoords(lat, lng, randomLat, randomLng);
      console.log("Dist till random spot:", dist);
    }

    console.log("randomLat:", randomLat);
    console.log("randomLng:", randomLng);
    return { randomLat, randomLng };
  }

  getDirections(originLat, originLng, destLat, destLng) {
    console.log("110. getDirections()");
    return new Promise((resolve, reject) => {

      https.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=bicycling&key=${process.env.GOOGLE_MAPS_KEY}`, (res) => {
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

            resolve(parsedData.routes[0].legs[0].steps);

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

  getDummyRiders() {
    console.log("201. getDummyRiders()");
    return this.checkSupplyOfDummyMembers()
      .then(count => {
        console.log("203. Returned from checkSupplyOfDummyMembers();");
        if ( count - dummyRiders.length < 5 ) {
          return User.addDummyMembers(user.email).then(() => {
            console.log("204. Just added dummy members.");
            return this.addDummyRiders();
          });
        } else {
          console.log("204. No need to dummy members.");
          return this.addDummyRiders();
        }
      })
      .catch(err => {
        console.log("dummyRidersPromise.catch()", err); // Todo: Handle error.
      });
  }

  getIntermediateSteps(steps) {
    let detailedSteps = [];

    let counter = 0;

    while ( counter < 100 ) {
      if ( steps[counter + 1] ) {
        let currentLat = dummy.position.coords.latitude;
        let currentLng = dummy.position.coords.longitude;
        let nextLat = steps[counter].end_location.lat;
        let nextLng = steps[counter].end_location.lng;
        let dist = this.distanceBetweenCoords(currentLat, currentLng, nextLat, nextLng);
        console.log("dist:", dist);
        if ( dist < 30 ) {
          position.coords.latitude = nextLat;
          position.coords.longitude = nextLng;
          counter++;
        } else {
          let divider = dist / 30;
          divider *= (.9 + Math.random() * .2);
          position.coords.latitude = currentLat + (nextLat - currentLat) / divider;
          position.coords.longitude = currentLng + (nextLng - currentLng) / divider;
        }
      }
    }

    this.onUpdateUserPosition(io, dummy.fauxSocketId, position);
    if ( !steps[counter] ) clearInterval(dummy.intervalTimer);
  }

  getSteps(steps, userLat, userLng) {
    console.log("101. getSteps()");
    return new Promise((resolve, reject) => {
      if ( steps ) {
        console.log("There are already steps");
        resolve(steps);
        return;
      }
      console.log("There are no steps yet!");

      return this.snapToRoad(userLat, userLng)
        .then(({snappedLat, snappedLng}) => {
          console.log("103. Returned from snapToRoad()");
          console.log("snappedLat:", snappedLat);
          console.log("snappedLng:", snappedLng);

          return this.setDestination(snappedLat, snappedLng)
        }).then(({destLat, destLng}) => {
        console.log("109. Returned from setDestination()");
          return this.getDirections(userLat, userLng, destLat, destLng);
        }).then(steps => {
          console.log("111. Returned from getDirections");

          // this.getIntermediateSteps(steps);

          resolve(steps);
        })
        .catch(err => {
          console.log("Catch set directly on this.setDestination(). err:", err);
          callback(err.message);
        });
    });
  }

  onGiveMeRiderList(socketId, socket, ride) {
    let requestingRider = RiderService.getRider(socketId);
    if ( !requestingRider ) console.log("The requesting rider was not found in riderList");
    if ( requestingRider ) {
      if ( requestingRider.leader || requestingRider.admin ) {
        socket.emit('riderList', RiderService.getRiderList(ride));
      } else {
        socket.emit('riderList', RiderService.getPublicRiderList(ride));
      }
    }
  }

  onJoinedRide(io, socket, user, ride, socketId) {
    console.log("onJoinedRide:", user.fname, user.lname, socketId);

    socket.join(ride);
    if ( user.admin ) socket.join('admins');

    let rider = RiderService.addRider(user, ride, socketId);

    if ( rider.leader ) {
      // The joinedRider is a ride leader, so emit the rider's full info to everybody on the ride.
      console.log(`1. About to emit all info about rider ${rider.fname} ${rider.lname} with phone ${rider.phone} in
      ${rider.ride}`);
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone', 'dummy', 'emergencyName', 'emergencyPhone'))
    } else {
      // The joinedRider is NOT a ride leader, so emit only public info to everybody on the ride.
      console.log(`2. About to emit *some* info to ${rider.fname} ${rider.lname} in ${rider.ride}.`);
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'dummy'))
    }

    // Emit all info about the joinedRider to ride leaders on the ride.
    // Todo: What happens if this arrives before the message emitted above? Should I set a small delay?
    let rideLeaders = RiderService.getRideLeaders(rider.ride);
    rideLeaders.forEach(leader => {
      console.log(`3. About to emit all info about rider ${rider.fname} ${rider.lname} with phone ${rider.phone} to leader ${leader.fname} ${leader.lname} in ${rider.ride}`);
      io.in(rider.ride).to(leader.socketId).emit('joinedRider', rider);
    });
  }

  onLeaveRide(io, socketId) {
    let rider = RiderService.getRider(socketId);
    if ( rider ) {  // Safety precaution.
      console.log("onleaveRide(). ride:", rider.ride, "rider:", rider.fname, rider.lname, rider._id);
      RiderService.removeRider(rider);
      io.to(rider.ride).emit('removedRider', _.pick(rider, '_id')._id.toString()); // _id is a mongoDB ObjectId.
    }
  }

  onUpdateUserPosition(io, socketId, position) {
    console.log("onUpdateUserPosition. socketId:", socketId);
    let rider = RiderService.updateRiderPosition(socketId, position);
    if ( rider ) {
      console.log("rider:", rider.fname, rider.lname, rider.ride, rider._id);
      setTimeout(() => {
        io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
      }, 200);
    }
  }

  setDestination(lat, lng, errorCount = 0) {
    console.log("104. setDestionation(). errorCount:", errorCount);
    let { randomLat, randomLng } = this.generateRandomPosition(lat, lng);
    console.log("106. returned from generateRandomPosition", randomLat, randomLng);

    return this.findNearbyPlace(randomLat, randomLng)
      .then(({placeLat, placeLng}) => {
      console.log("108. Returned from findNearbyPlace()");
        let destLat = placeLat;
        let destLng = placeLng;

        return {destLat, destLng};
      })
      .catch(err => {
        console.log("setDestination.catch(). errorCount:", errorCount, err.message);
        if ( errorCount++ < 10 ) {
          return this.setDestination(lat, lng, errorCount);
        } else {
          console.log("Okay, we failed!");
          return Promise.reject('Failed to set destination (from setDestination.catch())');
        }
      });
  }

  setDummyRidersCoordsInterval(io, dummy, steps) {
    console.log("302. setDummyRidersCoordsInterval()");
    console.log(dummy.fname, dummy.lname, dummy.fauxSocketId);

    let position = {
      coords: {
        latitude: steps[0].start_location.lat,
        longitude: steps[0].start_location.lng
      }
    };

    this.onUpdateUserPosition(io, dummy.fauxSocketId, position);

    let counter = 0;
    let time = Math.random() * 1000;

    dummy.intervalTimer = setInterval(() => {

      if ( steps[counter + 1] ) {
        let currentLat = dummy.position.coords.latitude;
        let currentLng = dummy.position.coords.longitude;
        let nextLat = steps[counter].end_location.lat;
        let nextLng = steps[counter].end_location.lng;
        let dist = this.distanceBetweenCoords(currentLat, currentLng, nextLat, nextLng);
        console.log("dist:", dist);
        if ( dist < 30 ) {
          position.coords.latitude = nextLat;
          position.coords.longitude = nextLng;
          counter++;
        } else {
          let divider = dist / 30;
          divider *= (.9 + Math.random() * .2);
          position.coords.latitude = currentLat + (nextLat - currentLat) / divider;
          position.coords.longitude = currentLng + (nextLng - currentLng) / divider;
        }
      }

      this.onUpdateUserPosition(io, dummy.fauxSocketId, position);
      if ( !steps[counter] ) clearInterval(dummy.intervalTimer);
    }, 1000 + time);
  }

  snapToRoad(lat, lng) {
    console.log("102. snapToRoad()");
    return new Promise((resolve, reject) => {

      https.get(`https://roads.googleapis.com/v1/snapToRoads?path=${lat},${lng}&key=${process.env.GOOGLE_MAPS_KEY}`, (res) => {
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
            let snappedLat = parsedData.snappedPoints[0].location.latitude;
            let snappedLng = parsedData.snappedPoints[0].location.longitude;

            resolve({snappedLat, snappedLng});
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
}

module.exports = { SocketServer };
