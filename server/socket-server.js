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
 */

class SocketServer {

  startSocketServer(io) {
    io.on('connection', socket => {
      let abortDummyRiders = false;
      let steps = [];

      socket.emit('socketConnection', socket.id);

      // AddConnectedLoggedInUser
      socket.on('addConnectedLoggedInUser', email => {
        UserService.addConnectedLoggedInUser(email, socket.id);
      });

      // addDummyRiders
      socket.on('addDummyRiders', (user, token, callback) => {
        socket.emit('debugging', 'addDummyRiders');
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {
          socket.emit('debugging', 'addDummyRiders. token found');
          abortDummyRiders = false;

          let userLat = user.position.coords.latitude;
          let userLng = user.position.coords.longitude;

          let stepsPromise = new Promise((resolve, reject) => {
            if ( steps.length > 0 ) {
              socket.emit('debugging', 'About to resolve stepsPromise at place 1');
              resolve(steps);
            } else {
              this.getSteps(userLat, userLng)
                .then(setOfSteps => {
                  socket.emit('debugging', 'stepsPromise. steps gotten 1.');
                  steps.push(...setOfSteps);
                  let lastStep = steps[steps.length - 1];
                  return this.getSteps(lastStep.lat, lastStep.lng)
                })
                .then(setOfSteps => {
                  socket.emit('debugging', 'stepsPromise. steps gotten 2.');
                  steps.push(...setOfSteps);
                  socket.emit('debugging', 'About to resolve stepsPromise at place 2');
                  resolve(steps);
                });
            }
          });

          let dummyRidersPromise = new Promise((resolve, reject) => {
            this.getDummyRiders(socket)
              .then(dummies => {
                socket.emit('debugging', '100. dummyRiders gotten.');
                if (dummies.length) socket.emit('debugging', '101. Number of dummyRiders: ' + dummies.length);
                dummies.forEach(dummy => {
                  dummy.fauxSocketId = dummyRiders.length;
                  dummy.position = {
                    coords: {
                      latitude: user.position.coords.latitude + Math.random() * .0002 - .0001,
                      longitude: user.position.coords.longitude + Math.random() * .0002 - .0001
                    }
                  };

                  socket.emit('debugging', '102. About to call onJoinedRide.');
                  this.onJoinedRide(io, socket, dummy, user.ride, dummy.fauxSocketId);
                  dummyRiders.push(dummy);
                });

                socket.emit('debugging', '103. About to resolve dummyRidersPromise');
                resolve(dummies);
              });
          });

          return Promise.all([stepsPromise, dummyRidersPromise])
            .then(values => {
              socket.emit('debugging', 'addDummyRiders. both promises fulfilled');
              if ( abortDummyRiders ) return;

              steps = values[0];
              let dummies = values[1];
              dummies.forEach(dummy => {
                // Delay, to lessen the risk that socket messages will arrive in the wrong order.
                setTimeout(() => {
                  this.setDummyRidersCoordsInterval(io, dummy, steps);
                }, 1000);
              });


            }).catch(err => {
              callback(err);
            });
        }).catch(err => {
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
        abortDummyRiders = true;
        steps = [];

        dummyRiders.forEach(dummy => {
          let rider = RiderService.getRider(dummy.fauxSocketId);
          this.onLeaveRide(io, dummy.fauxSocketId);
          io.in(ride).emit('removedRider', rider._id);
          setTimeout(() => {
            clearInterval(dummy.intervalTimer);
          }, 200);
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
        UserService.removeConnectedLoggedInUser(socket.id);

        let rider = RiderService.getRider(socket.id);

        if ( rider ) {
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
    console.log("addDummyRiders()");
    return User.getDummyUsers(dummyRiders.length, 5)
      .then(dummies => {
        return dummies;
      });
  }

  checkSupplyOfDummyMembers(socket) {
    socket.emit('debugging', '300. Just entered checkSupplyOfDummyMembers');
    // socket.emit('debugging', User.count({ dummy: true }));
    // console.log("User.count:");
    // console.log(User.count({ dummy: true }));


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
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`); // Todo: Handle error.
      });
    });
  }

  generateRandomPosition(lat, lng) {
    let randomLat;
    let randomLng;
    let dist = 0;

    while ( dist < 7000 ) {
      randomLat = lat + Math.random() * .2 - .1;
      randomLng = lng + Math.random() * .2 - .1;

      dist = this.distanceBetweenCoords(lat, lng, randomLat, randomLng);
    }

    return { randomLat, randomLng };
  }

  getDirections(originLat, originLng, destLat, destLng) {
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
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`); // Todo: Handle error.
      });
    });
  }

  getDummyRiders(socket) {
    socket.emit('debugging', '200. Just entered getDummyRiders');
    return this.checkSupplyOfDummyMembers(socket)
      .then(count => {
        socket.emit('debugging', 'count: ' + count);
        socket.emit('debugging', 'dummyRiders.length: ' + dummyRiders.length);
        if ( count - dummyRiders.length < 5 ) {
          return User.addDummyMembers(user.email)
            .then(() => {
              socket.emit('debugging', '201. About to return this.addDummyRiders()');
              return this.addDummyRiders();
            });
        } else {
          socket.emit('debugging', '202. About to return this.addDummyRiders()');
          return this.addDummyRiders();
        }
      })
      .catch(err => {
        console.log("dummyRidersPromise.catch()", err); // Todo: Handle error.
      });
  }

  getSmallSteps(steps) {
    let smallSteps = [steps[0]];
    let stepsCounter = 1;

    for ( let i = 0; i < 99; i++ ) {
      if ( steps[stepsCounter] ) {
        let currentLat = smallSteps[i].lat;
        let currentLng = smallSteps[i].lng;
        let nextLat = steps[stepsCounter].lat;
        let nextLng = steps[stepsCounter].lng;
        let dist = this.distanceBetweenCoords(currentLat, currentLng, nextLat, nextLng);
        if ( dist < 30 ) {
          smallSteps.push({ lat: nextLat, lng: nextLng });
          stepsCounter++;
        } else {
          let divider = dist / 30;
          divider *= (.9 + Math.random() * .2);
          smallSteps.push({
            lat: currentLat + (nextLat - currentLat) / divider,
            lng: currentLng + (nextLng - currentLng) / divider
          });
        }
      }
    }

    return smallSteps;
  }

  getSteps(lat, lng) {
    return this.snapToRoads([{ lat, lng }])
      .then(snappedPoints => {
        return this.setDestination(snappedPoints[0].lat, snappedPoints[0].lng)
      }).then(({ destLat, destLng }) => {
        return this.getDirections(lat, lng, destLat, destLng);
      }).then(steps => {
        let simplifiedSteps = this.simplifySteps(steps);
        let smallSteps = this.getSmallSteps(simplifiedSteps);

        return this.snapToRoads(smallSteps);
      })
      .catch(err => {
        callback(err.message);
      });
  }

  onGiveMeRiderList(socketId, socket, ride) {
    let requestingRider = RiderService.getRider(socketId);
    if ( requestingRider ) {
      if ( requestingRider.leader || requestingRider.admin ) {
        socket.emit('riderList', RiderService.getRiderList(ride));
      } else {
        socket.emit('riderList', RiderService.getPublicRiderList(ride));
      }
    }
  }

  onJoinedRide(io, socket, user, ride, socketId) {
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
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone', 'dummy', 'emergencyName', 'emergencyPhone'))
    });
  }

  onLeaveRide(io, socketId) {
    let rider = RiderService.getRider(socketId);
    if ( rider ) {  // Safety precaution.
      RiderService.removeRider(rider);
      io.to(rider.ride).emit('removedRider', _.pick(rider, '_id')._id.toString()); // _id is a mongoDB ObjectId.
    }
  }

  onUpdateUserPosition(io, socketId, position) {
    let rider = RiderService.updateRiderPosition(socketId, position);
    if ( rider ) {
      setTimeout(() => {
        io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
      }, 200);
    }
  }

  setDestination(lat, lng, errorCount = 0) {
    let { randomLat, randomLng } = this.generateRandomPosition(lat, lng);

    return this.findNearbyPlace(randomLat, randomLng)
      .then(({ placeLat, placeLng }) => {
        let destLat = placeLat;
        let destLng = placeLng;

        return { destLat, destLng };
      })
      .catch(err => {
        console.log("setDestination.catch(). errorCount:", errorCount, err.message);
        if ( errorCount++ < 10 ) {
          return this.setDestination(lat, lng, errorCount);
        } else {
          return Promise.reject('Failed to set destination.');
        }
      });
  }

  setDummyRidersCoordsInterval(io, dummy, steps) {
    let counter = 0;
    let time = ( (+dummy.fauxSocketId + 1) % 5) * 150;

    dummy.intervalTimer = setInterval(() => {
      let position = {
        coords: {
          latitude: steps[counter].lat + Math.random() * .00006 - .00003,
          longitude: steps[counter].lng + Math.random() * .00006 - .00003,
        }
      };

      this.onUpdateUserPosition(io, dummy.fauxSocketId, position);
      if ( !steps[++counter] ) {
        clearInterval(dummy.intervalTimer);
      }
    }, 1600 + time);
  }

  simplifySteps(steps) {
    let simplifiedSteps = [{
      lat: steps[0].start_location.lat,
      lng: steps[0].start_location.lng
    }];

    steps.forEach(step => {
      simplifiedSteps.push({
        lat: step.end_location.lat,
        lng: step.end_location.lng
      })
    });

    return simplifiedSteps;
  }

  snapToRoads(points) {
    points = points.map(point => {
      return `${point.lat},${point.lng}`;
    });
    let path = points.join('|');

    return new Promise((resolve, reject) => {

      https.get(`https://roads.googleapis.com/v1/snapToRoads?path=${path}&key=${process.env.GOOGLE_MAPS_KEY}`, (res) => {
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

            let snappedPoints = parsedData.snappedPoints.map(point => {
              return { lat: point.location.latitude, lng: point.location.longitude };
            });

            resolve(snappedPoints);
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
