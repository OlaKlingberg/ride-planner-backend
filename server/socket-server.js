const _ = require("lodash");

const { User } = require('./models/user');
const { Ride } = require('./models/ride');
const { RiderService } = require('./utils/rider-service');

const https = require('https');

let dummyRiders = [];
let latSign = null;
let lngSign = null;


class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
      console.log("connection. socket.id:", socket.id, new Date().toString());

      socket.emit('socketConnection');

      // add10riders
      socket.on('addTenRiders', (user, token) => {
        // Verify that there is a user with that token. // Todo: Is that enough verification?
        User.findByToken(token).then(() => {

          this.snapToRoad(user.position)
            .then(snappedPosition => {
              // Call a RiderService function that returns ten dummy users from the db.
              User.findNextTenDummyUsers(dummyRiders.length).then(dummies => {

                this.setDummyRiderCoords(socket, io, user.ride, snappedPosition, dummies);

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
          socket.emit('availableRides', rides);
        });
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
        lngSign = null;

        socket.leave(ride);
      });


      // updateUserPosition
      socket.on('updateUserPosition', position => {
        this.onUpdateUserPosition(socket.id, position, io);
      });


      // disconnect
      socket.on('disconnect', () => {
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
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone'))
    } else {
      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader'))
    }

    // Emits all info about the joinedRider to ride leaders on the ride.
    // Todo: What happens if this arrives before the message emitted above?
    let rideLeaders = RiderService.getRideLeaders(rider.ride);
    rideLeaders.forEach(leader => {
      // JSON.stringify(rider.position.coords.latitude));

      io.in(rider.ride).emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader'));
      // io.in(rider.ride).emit('joinedRider', rider); // Todo: Why does this sent "latitude: undefined"?
    });

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

  onUpdateUserPosition(socketId, position, io) {
    // console.log("onUpdateUserPosition. socketId:", socketId);
    let rider = RiderService.updateRiderPosition(socketId, position);
    if ( rider ) {
      setTimeout(() => {
        io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
      }, 200);
    }
  }

  snapToRoad(position) {
    return new Promise((resolve, reject) => {

      https.get(`https://roads.googleapis.com/v1/snapToRoads?path=${position.coords.latitude},${position.coords.longitude}&key=AIzaSyDcbNgBS0ykcFj8em8xT5WcDHZbFiVL5Ok`, (res) => {
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

  setDummyRiderCoords(socket, io, ride, snappedPosition, dummies) {
    console.log("latSign:", latSign);
    if (latSign === null) {
      latSign = Math.sign(Math.random() - .5);
      lngSign = Math.sign(Math.random() - .5);
      console.log("Set latSign to:", latSign, "and lngSign to:", lngSign);
    }

    let latInc = Math.random() * .0001;
    let lngInc = Math.random() * .0001;
    if (latInc < .000025 && lngInc < .000025) {
      latInc *= 4;
      lngInc *= 4;
    }

    latInc *= latSign;
    lngInc *= lngSign;

    // let latInc = Math.random() * .0002 - .0001;
    // // const latInc = Math.random() * .0008 - .0004;
    // let lngInc = Math.random() * .0002 - .0001;
    // // const lngInc = Math.random() * .0008 - .0004;
    //
    // if (Math.abs(latInc) < .000025 && Math.abs(lngInc) < .000025) {
    //   console.log("latInc:", latInc);
    //   console.log("lngInc:", lngInc);
    //   latInc *= 4;
    //   lngInc *= 4;
    //   console.log("latInc and lngInc were too small, so I increased them to:", latInc, lngInc);
    // }


    console.log("latInc:", latInc);
    console.log("lngInc:", lngInc);

    if ( Math.abs(latInc) < .00005 && Math.abs(lngInc) < .00005 ) return this.setDummyRiderCoords(socket, io, ride, snappedPosition, dummies);

    // Loop through these ten dummy users and on each:
    dummies.forEach(dummy => {
      if ( dummy.timer ) clearInterval(dummy.timer);

      const stepSize = Math.random() * .3 + 1;
      this.setDummyRiderCoordsIntervalTimer(socket, io, ride, snappedPosition, dummy, latInc * stepSize, lngInc * stepSize);
    });
  }

  setDummyRiderCoordsIntervalTimer(socket, io, ride, snappedPosition, dummy, latInc, lngInc) {
    let prevSnappedLat = null;
    let prevSnappedLng = null;
    let incToFlip = 'latInc';
    dummy.position = {
      coords: {
        latitude: snappedPosition.coords.latitude + Math.random() * .00006 - .00003,
        longitude: snappedPosition.coords.longitude + Math.random() * .00006 - .00003
      }
    };
    dummy.fauxSocketId = dummyRiders.length;

    // call onJoinedRide
    this.onJoinedRide(dummy, ride, () => {
    }, dummy.fauxSocketId, socket, io);
    // set an intervalTimer that calls onUpdateUserPosition
    dummy.timer = setInterval(() => {
      // Modify the position
      dummy.position.coords.latitude += latInc;
      dummy.position.coords.longitude += lngInc;

      this.snapToRoad(dummy.position)
        .then(snappedPosition => {
          if (!prevSnappedLat) {
            prevSnappedLat = dummy.position.coords.latitude;
            prevSnappedLng = dummy.position.coords.longitude;
          } else {
            // console.log("lat-diff:", prevSnappedLat - dummy.position.coords.latitude);
            // console.log("lng-diff:", prevSnappedLng - dummy.position.coords.longitude);

            if (Math.abs(prevSnappedLat - dummy.position.coords.latitude) < .00002 &&
            Math.abs(prevSnappedLng - dummy.position.coords.longitude) < .00002) {
              console.log("Before:", Math.sign(latInc), Math.sign(lngInc));
              incToFlip === 'latInc' ? latInc *= -1 : lngInc *= -1;
              incToFlip = incToFlip === 'latInc' ? 'lngInc' : 'latInc';
              console.log("After:", Math.sign(latInc), Math.sign(lngInc));
              console.log("-------------");
            }
            prevSnappedLat = dummy.position.coords.latitude;
          }

          this.onUpdateUserPosition(dummy.fauxSocketId, snappedPosition, io, true)
        })
        .catch(e => {
            console.log("onUpdateUserPosition napToRoad.catch(e)", e); // Todo: Do I need any error handling here?
          }
        );
    }, Math.random() * 3000 + 3000);
    dummyRiders.push(dummy);
  }


}

module.exports = { SocketServer };
