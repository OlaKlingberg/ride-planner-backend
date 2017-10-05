const _ = require("lodash");

const { User } = require('./models/user');
const { Ride } = require('./models/ride');
const { RiderService } = require('./utils/rider-service');

const https = require('https');

numberOfDummyRiders = 0;
intervalTimers = [];

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
      console.log("connection. socket.id:", socket.id, new Date().toString());

      socket.emit('socketConnection');

      // add10riders
      socket.on('addTenRiders', (user, token) => {
        console.log("addTenRiders. user.ride:", user.ride);
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {
          // Call a RiderService function that returns ten dummy users from the db.
          User.findNextTenDummyUsers(numberOfDummyRiders).then(dummyRiders => {
            // dummyUsers.forEach(dummy => console.log(dummy.fname, dummy.lname));

            // Loop through these ten dummy users and on each:
            dummyRiders.forEach(dummy => {
              // Set a position and increments to use
              const latIncrement = Math.random() * .0002 - .0001;
              const lngIncrement = Math.random() * .0002 - .0001;
              dummy.position = {
                coords: {
                  latitude: user.position.coords.latitude += latIncrement,
                  longitude: user.position.coords.longitude += lngIncrement
                }
              };
              dummy.fauxSocketId = ++numberOfDummyRiders;

              // call onJoinedRide
              // console.log("dummy.fauxSocketId:", dummy.fauxSocketId);
              this.onJoinedRide(dummy, user.ride, () => {}, dummy.fauxSocketId, socket, io);
              // set an intervalTimer that calls onUpdateUserPosition
              const timer = setInterval(() => {
                // Modify the position
                dummy.position.coords.latitude += latIncrement;
                dummy.position.coords.longitude += lngIncrement;
                this.onUpdateUserPosition(dummy.fauxSocketId, dummy.position, io, true)
              }, Math.random() * 3000 + 1000);
              intervalTimers.push(timer);
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

        Ride.getRides().then(rides => {
          // console.log("rides:", rides);
          socket.emit('availableRides', rides);
        });
      });


      // giveMeRiderList
      socket.on('giveMeRiderList', ride => {
        // console.log("socket.on('giveMeRiderList'). ride:", ride, new Date().toString());
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


      // removeDummyRiders
      socket.on('removeDummyRiders', (ride) => {
        for (let fauxSocketId = 1; fauxSocketId <= numberOfDummyRiders; fauxSocketId++) {
          // let rider = RiderService.getRider(i);
          this.onLeaveRide(fauxSocketId, socket, io);
          // io.in(ride).emit('removedRider', rider._id);
        }
        numberOfDummyRiders = 0;
        intervalTimers.forEach(timer => clearInterval(timer));
        socket.leave(ride); // Should fail quietly for dummy riders.
      });


      // updateUserPosition
      socket.on('updateUserPosition', position => {
        this.onUpdateUserPosition(socket.id, position, io);
      });


      // disconnect
      socket.on('disconnect', () => {
        // console.log('disconnect. socket.id:', socket.id, new Date().toString());
        let rider = RiderService.getRider(socket.id);

        if ( rider ) {
          console.log('Disconnected rider:', rider.fname, rider.lname);
          RiderService.markAsDisconnected(rider);
          socket.leave(rider.ride);
          // Delay, to minimize the risk that riderList and disconnectedRider are received in the wrong order.
          // setTimeout(() => {
          socket.in(rider.ride).emit('disconnectedRider', _.pick(rider, '_id', 'disconnected'));
          // }, 200);
        }
      });

    });
  }

  onGiveMeRiderList(socketId, socket, ride) {
    let requestingRider = RiderService.getRider(socketId);
    if ( !requestingRider ) console.log("The requesting rider was not found in riderList");
    if ( requestingRider ) {
      // console.log("requestingRider:", requestingRider.fname, requestingRider.lname, "Leader:", requestingRider.leader);
      if ( requestingRider.leader || requestingRider.admin ) {
        // console.log("About to emit riderList.", new Date().toString(), "riderList:",
        // RiderService.getRiderList(ride));
        socket.emit('riderList', RiderService.getRiderList(ride));
      } else {
        // console.log("About to generate and emit riderList for ride:", ride);
        // console.log("About to emit riderList.", new Date().toString(), RiderService.getRiderList(ride));
        socket.emit('riderList', RiderService.getPublicRiderList(ride));
      }
    }
  }

  onJoinedRide(user, ride, callback, socketId, socket, io) {
    console.log("onJoinedRide. user:", user.fname, user.lname);
    // Emits public info about the joinedRider to everybody on the ride.
    let rider = RiderService.addRider(user, ride, socketId);

    if ( rider.leader ) {
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone'))
    } else {
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader'))
    }

    // Emits all info about the joinedRider to ride leaders on the ride.
    // Todo: What happens if this arrives before the message emitted above?
    let rideLeaders = RiderService.getRideLeaders(rider.ride);
    rideLeaders.forEach(leader => {
      io.to(leader.socketId).emit('joinedRider', rider);
    });

    socket.join(ride);
    if ( user.admin ) socket.join('admins');

    callback();
  }

  onLeaveRide(socketId, socket, io) {
    let rider = RiderService.getRider(socketId);
    if ( rider ) {  // Safety precaution.
      console.log("onleaveRide(). ride:", rider.ride, "rider:", rider.fname, rider.lname, rider._id);
      RiderService.removeRider(rider);
      // io.in(rider.ride).emit('removedRider', _.pick(rider, '_id')._id.toString()); // _id is a mongoDB ObjectId.
      io.to(rider.ride).emit('removedRider', _.pick(rider, '_id')._id.toString()); // _id is a mongoDB ObjectId.
    }
  }

  onUpdateUserPosition(socketId, position, io, dummy = false) {
    if (dummy) {
      https.get(`https://roads.googleapis.com/v1/snapToRoads?path=${position.coords.latitude},${position.coords.longitude}&key=AIzaSyDcbNgBS0ykcFj8em8xT5WcDHZbFiVL5Ok`, (res) => {
        const statusCode = res.statusCode;
        const contentType = res.headers['content-type'];

        let error;
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
          error = new Error('Invalid content-type.\n' +
            `Expected application/json but received ${contentType}`);
        }
        if (error) {
          console.log(error.message);
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
            position.coords.latitude = snappedPoint.latitude;
            position.coords.longitude = snappedPoint.longitude;

            let rider = RiderService.updateRiderPosition(socketId, position);
            if ( rider ) {
              setTimeout(() => {
                io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
              }, 200);
            }
          } catch (e) {
            console.log(e.message);
          }
        });
      }).on('error', (e) => {
        console.log(`Got error: ${e.message}`);
      });
    } else {
      let rider = RiderService.updateRiderPosition(socketId, position);
      if ( rider ) {
        setTimeout(() => {
          io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
        }, 200);
      }
    }

  }




}

module.exports = { SocketServer };
