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
let snapToRoadCounter = 0;
let steps = [];

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
          let lat1 = user.position.coords.latitude;
          let lng1 = user.position.coords.longitude;

          let { lat2, lng2 } = this.generateRandomPosition(lat1, lng1);
          console.log("Random lat2:", lat2);
          console.log("Random lng2:", lng2);

          this.findNearbyPlace(lat2, lng2).then(({ lat2, lng2 }) => {
            console.log("Place lat2:", lat2);
            console.log("Place lng2:", lng2);

            User.count({ dummy: true }, (err, count) => {
              console.log(`Number of dummyRiders: ${dummyRiders.length}.`);
              console.log(`Number of dummy users: ${count}`);
              if ( count - dummyRiders.length < 5 ) {
                console.log("Need to add dummy members.");
                User.addDummyMembers(user.email).then(() => {
                  console.log("Just added dummy members.");
                  this.addSomeDummyRiders(io, socket);
                });
              } else {
                console.log("No need to dummy members.");
                this.addSomeDummyRiders(io, socket);
              }
            })
          }).catch(err => {
            console.log("This is where I need to handle the error! -----------------------------------------");
            callback('Error')
          });
        }).catch(err => {
          console.log("Err:", err); // Todo: Handle error.
        });

        // User.findByToken(token).then(() => {
        //   console.log("addDummyRiders");
        //
        //   this.snapToRoad(user.position, callback)
        //     .then(snappedPosition => {
        //       // Call a RiderService function that returns five dummy users from the db.
        //       User.getDummyUsers(dummyRiders.length, 5).then(dummies => {
        //         // Todo: The way I handle the situation if there are too few users is kind of ugly (but it works).
        //         if ( dummies.length < 5 ) {
        //           User.addDummyMembers()
        //             .then(() => {
        //               this.setDummyRiderCoords(socket, io, user.ride, snappedPosition, dummies, callback);
        //             });
        //         }
        //
        //         this.setDummyRiderCoords(socket, io, user.ride, snappedPosition, dummies, callback);
        //       });
        //     });
        //
        // }).catch(err => {
        //   console.log("The user was not found! err:", err); // Todo: Handle error.
        // });
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
        console.log('removeDummyRiders');
        dummyRiders.forEach(dummy => {
          clearInterval(dummy.intervalTimer);
          clearTimout(dummy.removeTimer);
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

    let rider = RiderService.addRider(user, ride, socketId);

    if ( rider.leader ) {
      // The joinedRider is a ride leader, so emit the rider's full info to everybody on the ride.
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone', 'dummy', 'emergencyName', 'emergencyPhone'))
    } else {
      // The joinedRider is NOT a ride leader, so emit only public info to everybody on the ride.
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'dummy'))
    }

    // Emit all info about the joinedRider to ride leaders on the ride.
    // Todo: What happens if this arrives before the message emitted above? Should I set a small delay?
    let rideLeaders = RiderService.getRideLeaders(rider.ride);
    rideLeaders.forEach(leader => {
      console.log(`About to emit all info about rider ${rider.fname} ${rider.lname} with phone ${rider.phone} to leader ${leader.fname} ${leader.lname}`);
      io.in(rider.ride).to(leader.socketId).emit('joinedRider', rider);
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
    // console.log("snapToRoad(position) position:", position, "GOOGLE_MAPS_KEY:", process.env.GOOGLE_MAPS_KEY);
    return new Promise((resolve, reject) => {

      console.log("snapToRoads, calls #:", ++snapToRoadCounter);

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
      if ( dummy.intervalTimer ) clearInterval(dummy.intervalTimer);

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
    dummy.intervalTimer = setInterval(() => {
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

    dummy.removeTimer = setTimeout(() => {
      clearInterval(dummy.intervalTimer);
      io.to(dummy.ride).emit('removedRider', _.pick(dummy, '_id')._id.toString()); // _id is a mongoDB ObjectId.
      dummyRiders = dummyRiders.filter(dummyRider => dummyRider._id !== dummy._id);
    }, 300000);
  }

  generateRandomPosition(lat1, lng1) {
    let lat2;
    let lng2;

    let dist = 0;

    while ( dist < 7000 ) {
      lat2 = lat1 + Math.random() * .2 - .1;
      lng2 = lng1 + Math.random() * .2 - .1;

      dist = this.distanceBetweenCoords(lat1, lng1, lat2, lng2);
      console.log("Dist till random spot:", dist);
    }

    return { lat2, lng2 };
  }

  findNearbyPlace(lat, lng) {
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

            const lat2 = parsedData.results[0].geometry.location.lat;
            const lng2 = parsedData.results[0].geometry.location.lng;

            resolve({ lat2, lng2 });
          } catch ( e ) {
            console.log(e.message);
            reject(e);
            // resolve('Error!', {lat2, lng2});
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`);
      });
    });

  }

  getDirections(lat1, lng1, lat2, lng2) {
    return new Promise((resolve, reject) => {

      https.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${lat1},${lng1}&destination=${lat2},${lng2}&mode=bicycling&key=${process.env.GOOGLE_MAPS_KEY}`, (res) => {
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

  addSomeDummyRiders(io, socket) {
    console.log("addSomeDummyRiders()");
    User.getDummyUsers(dummyRiders.length, 5).then(dummies => {
      dummyRiders.push(...dummies);
      console.log(`Just added ${dummies.length} to dummyRiders, which is now ${dummyRiders.length} riders long!`);
    });
  }




}

module
  .exports = { SocketServer };
