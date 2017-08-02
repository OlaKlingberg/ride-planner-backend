const _ = require("underscore");

const { User } = require('./models/user');
const { Ride } = require('./models/ride');
const { RideService } = require('./utils/ride-service');
const { RiderService } = require('./utils/rider-service');

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
        // console.log("connection. socket.id:", socket.id, new Date().toString());

        socket.emit('socketConnection');

        // console.log('riderList for Asbury Park upon connection', RiderService.getRiderList('Asbury Park').map(rider
        // => `${rider.fname} ${rider.lname}`));

        socket.on('giveMeAvailableRides', () => {
          console.log("socket.on('giveMeAvailableRides')");

          Ride.getRides().then(rides => {
              console.log("rides:", rides);
              socket.emit('availableRides', rides);
            });
        });

        socket.on('joinRide', (user, ride, token, callback) => {
          console.log("socket.on('joinRide'). ride:", ride);

          let rider = RiderService.addRider(user, ride, socket.id);

          socket.join(ride);

          User.findByToken(token).then(user => {
            if ( user.admin ) {
              socket.join('admins');
            }
          }).catch(err => {
            console.log("The user was not found! err:", err); // Todo: Handle error. Someone is pretending to be an admin.
          });


          // Emits public info about the joinedRider to everybody on the ride.
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

          callback();
        });

        socket.on('giveMeRiderList', ride => {
          console.log("socket.on('giveMeRiderList'). ride:", ride, new Date().toString());
          let requestingRider = RiderService.getRider(socket.id);
          if ( !requestingRider ) console.log("The requesting rider was not found in riderList");
          if ( requestingRider ) {
            console.log("requestingRider:", requestingRider.fname, requestingRider.lname, "Leader:", requestingRider.leader);
            if ( requestingRider.leader || requestingRider.admin ) {
              console.log("About to emit riderList.", new Date().toString());
              socket.emit('riderList', RiderService.getRiderList(ride));
            } else {
              console.log("About to emit riderList.", new Date().toString());
              socket.emit('riderList', RiderService.getPublicRiderList(ride));
            }
          }
        });

        socket.on('leaveRide', () => {
          let rider = RiderService.getRider(socket.id);
          if ( rider ) {  // Safety precaution.
            console.log("socket.on('leaveRide'). ride:", rider.ride);
            socket.leave(rider.ride);
            RiderService.removeRider(rider);
            io.in(rider.ride).emit('removedRider', _.pick(rider, '_id')._id.toString()); // _id is a mongoDB ObjectId.
          }
        });

        socket.on('updateUserPosition', position => {
          let rider = RiderService.updateRiderPosition(socket.id, position);
          if (rider) {
            setTimeout(() => {
              // if (rider.fname === 'Ada') console.log('New lat for Ada:', rider.position.coords.latitude * 1000);
              io.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
            }, 200);
          }
        });

        socket.on('debugging', message => {
          console.log("debugging", message);
          io.in('admins').emit('debugging', message);
        });

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

      }
    )
    ;

  }
}

module.exports = { SocketServer };
