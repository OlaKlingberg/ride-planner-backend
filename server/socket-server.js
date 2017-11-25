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
        // let ride = user.ride;
        // let position = user.position;
        // console.log("ride:", ride);
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {
          console.log("1a. Verified token.");
          // let lat1 = position.coords.latitude;
          // let lng1 = position.coords.longitude;

          let getStepsPromise = new Promise((resolve, reject) => {
            if ( steps ) {
              console.log("There are already steps");
              resolve(steps);
            } else {
              console.log("There are no steps yet!");
              return this.snapToRoad(user.position)
                .then(snappedPosition => {
                  console.log("1c. Returned from snapToRoad()");
                  console.log("snapped lat:", snappedPosition.coords.latitude);
                  console.log("snapped lng:", snappedPosition.coords.longitude);

                  return this.setDestination(snappedPosition)
                    .then(steps => {
                      console.log("8. Returned from setDestination");
                      resolve(steps);
                    })
                    .catch(err => {
                      console.log("Catch set directly on this.setDestination(). err:", err);
                      callback(err.message);
                    });
                });

            }
          });


          let dummyRidersPromise = this.checkSupplyOfDummyMembers()
            .then(count => {
              console.log("102. Returned from checkSupplyOfDummyMembers();");
              if ( count - dummyRiders.length < 5 ) {
                // console.log("Need to add dummy members.");
                return User.addDummyMembers(user.email).then(() => {
                  console.log("103. Just added dummy members.");
                  return this.addDummyRiders();
                });
              } else {
                console.log("103. No need to dummy members.");
                return this.addDummyRiders();
              }
            })
            .catch(err => {
              console.log("dummyRidersPromise.catch()", err); // Todo: Handle error.
            });

          return Promise.all([getStepsPromise, dummyRidersPromise])
            .then(values => {
              console.log("201. We have dummy riders, and we have steps!");
              steps = values[0];
              let dummies = values[1];
              steps.forEach(step => console.log(step.end_location));

              dummies.forEach(dummy => {
                console.log(dummy.fname, dummy.lname);
                dummy.fauxSocketId = dummyRiders.length;

                dummy.position = JSON.parse(JSON.stringify(user.position));
                console.log("------ dummy.position:", dummy.position);

                // Todo: Can I replace the empty function with null?
                this.onJoinedRide(io, socket, dummy, user.ride, () => {
                }, dummy.fauxSocketId);
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
        User.findByToken(token).then(() => {
          this.onJoinedRide(io, socket, user, ride, callback, socket.id);
        }).catch(err => {
          console.log("The user was not found! err:", err); // Todo: Handle error.
        });
      });

      // leaveRide
      socket.on('leaveRide', () => {
        this.onLeaveRide(io, socket, socket.id);
      });

      // RemoveConnectedLoggedInUser
      socket.on('removeConnectedLoggedInUser', email => {
        UserService.removeConnectedLoggedInUser(socket.id);
      });

      // removeDummyRiders
      socket.on('removeDummyRiders', (ride) => {
        console.log('removeDummyRiders');
        dummyRiders.forEach(dummy => {
          clearInterval(dummy.intervalTimer);
          // clearTimout(dummy.removeTimer);
          let rider = RiderService.getRider(dummy.fauxSocketId);
          this.onLeaveRide(io, socket, dummy.fauxSocketId);
          // console.log("rider:", rider);
          io.in(ride).emit('removedRider', rider._id);
        });

        dummyRiders = [];
        latSign = null;
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
    console.log("104. addDummyRiders()");
    return User.getDummyUsers(dummyRiders.length, 5)
      .then(dummies => {
        console.log(`105. Just added ${dummies.length} to dummyRiders, which is now ${dummyRiders.length} riders long!`);
        return dummies;
      });
  }

  checkSupplyOfDummyMembers() {
    console.log("101. checkSupplyOfDummyMembers()");
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
    console.log("5. findNearbyPlace()");
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
            console.log("findNearbyPlace. in the try-catch clause: e.message:", e.message);
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`);
      });
    });
  }

  generateRandomPosition(lat1, lng1) {
    console.log("3. generateRandomPosition()");
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

  getDirections(lat1, lng1, lat2, lng2) {
    console.log("7. getDirections()");
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

  onJoinedRide(io, socket, user, ride, callback, socketId) {
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

    callback();
  }

  onLeaveRide(io, socket, socketId) {
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
        // console.log(`About to emit updatedRiderPosition in ${rider.ride}:`);
        // console.log(_.pick(rider, '_id', 'position'));
        // io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
        io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
        // io.in(rider.ride).emit('updatedRiderPosition', 'TestMessage');
      }, 200);
    }
  }

  setDestination(position, errorCount = 0) {
    let lat1 = position.coords.latitude;
    let lng1 = position.coords.longitude;
    console.log("2. setDestionation(). errorCount:", errorCount);
    let { lat2, lng2 } = this.generateRandomPosition(lat1, lng1);
    console.log("4. returned from generateRandomPosition");
    // console.log("Random lat2:", lat2);
    // console.log("Random lng2:", lng2);

    return this.findNearbyPlace(lat2, lng2)
      .then(({ lat2, lng2 }) => {
        console.log("6. Returned from findNearbyPlace");

        console.log("We have a destination!");
        console.log("Dest lat2:", lat2);
        console.log("Dest lng2:", lng2);

        return this.getDirections(lat1, lng1, lat2, lng2);
      })
      .catch(err => {
        console.log("setDestination.catch(). errorCount:", errorCount, err.message);
        if ( errorCount++ < 10 ) {
          return this.setDestination(position, errorCount);
        } else {
          console.log("Okay, we failed!");
          return Promise.reject('Failed to set destination (from setDestination.catch())');
        }
      });
  }

  snapToRoad(position) {
    console.log("1b. snapToRoad()");
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
            position.coords.latitude = parsedData.snappedPoints[0].location.latitude;
            position.coords.longitude = parsedData.snappedPoints[0].location.longitude;

            resolve(position);
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


  setDummyRidersCoordsInterval(io, dummy, steps) {
    console.log("13. setDummyRidersCoordsInterval()");
    console.log(dummy.fname, dummy.lname, dummy.fauxSocketId);

    let position = {
      coords: {
        latitude: steps[0].start_location.lat,
        longitude: steps[0].start_location.lng
      }
    };

    this.onUpdateUserPosition(io, dummy.fauxSocketId, position);

    let counter = 0;
    let time = Math.random() * 500;

    dummy.intervalTimer = setInterval(() => {
      // console.log("dummy.intervalTimer:", dummy.intervalTimer);

      position.coords.latitude = steps[counter].end_location.lat;
      position.coords.longitude = steps[counter++].end_location.lng;

      this.onUpdateUserPosition(io, dummy.fauxSocketId, position);
      // if ( counter === steps.length - 1 ) {
      if ( !steps[counter] ) clearInterval(dummy.intervalTimer);
    }, 1500 + time);

  }

  // setDummyRiderCoords(socket, io, ride, snappedPosition, dummies, callback) {
  //   if ( latSign === null ) {
  //     latSign = Math.sign(Math.random() - .5);
  //     lngSign = Math.sign(Math.random() - .5);
  //
  //     latInc = Math.random() * .00012;
  //     lngInc = Math.random() * .00012;
  //     if ( latInc < .00008 && lngInc < .00008 ) {
  //       latInc += .00004;
  //       lngInc += .00004;
  //     }
  //
  //     latInc *= latSign;
  //     lngInc *= lngSign;
  //
  //     console.log("latInc:", latInc);
  //     console.log("lngInc:", lngInc);
  //   }
  //
  //   dummies.forEach(dummy => {
  //     if ( dummy.intervalTimer ) clearInterval(dummy.intervalTimer);
  //
  //     const stepSize = Math.random() * .2 + 1;
  //     this.setDummyRiderCoordsIntervalTimer(socket, io, ride, snappedPosition, dummy, latInc * stepSize, lngInc *
  //       stepSize);
  //   });
  //   callback();
  // }

  // setDummyRiderCoordsIntervalTimer(socket, io, ride, snappedPosition, dummy, latInc, lngInc) {
  //   let prevSnappedLat = null;
  //   let prevSnappedLng = null;
  //   let flipLatInc = true;
  //   dummy.position = {
  //     coords: {
  //       latitude: snappedPosition.coords.latitude + Math.random() * .00006 - .00003,
  //       longitude: snappedPosition.coords.longitude + Math.random() * .00006 - .00003
  //     }
  //   };
  //   dummy.fauxSocketId = dummyRiders.length;
  //   // dummy.creatorsSocketId = socket.id;
  //
  //   // Todo: Can I replace the empty function with null?
  //   this.onJoinedRide(io, socket, dummy, ride, () => {
  //   }, dummy.fauxSocketId);
  //
  //   dummy.intervalTimer = setInterval(() => {
  //     dummy.position.coords.latitude += latInc;
  //     dummy.position.coords.longitude += lngInc;
  //
  //     this.snapToRoad(dummy.position)
  //       .then(snappedPosition => {
  //         if ( prevSnappedLat &&
  //           Math.abs(prevSnappedLat - snappedPosition.coords.latitude) < .00007 &&
  //           Math.abs(prevSnappedLng - snappedPosition.coords.longitude) < .00007 ) {
  //           flipLatInc ? latInc *= -1.1 : lngInc *= -1.1;
  //           flipLatInc = !flipLatInc;
  //         }
  //
  //         prevSnappedLat = snappedPosition.coords.latitude;
  //         prevSnappedLng = snappedPosition.coords.longitude;
  //
  //         this.onUpdateUserPosition(io, dummy.fauxSocketId, snappedPosition)
  //       })
  //       .catch(e => {
  //           console.log("onUpdateUserPosition snapToRoad.catch(e)", e); // Todo: Do I need any error handling here?
  //         }
  //       );
  //   }, Math.random() * 1000 + 1500);
  //   dummyRiders.push(dummy);
  //
  //   dummy.removeTimer = setTimeout(() => {
  //     clearInterval(dummy.intervalTimer);
  //     io.to(dummy.ride).emit('removedRider', _.pick(dummy, '_id')._id.toString()); // _id is a mongoDB ObjectId.
  //     dummyRiders = dummyRiders.filter(dummyRider => dummyRider._id !== dummy._id);
  //   }, 300000);
  // }

}

module.exports = { SocketServer };
