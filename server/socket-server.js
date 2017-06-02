const _ = require("underscore");

const { User } = require('./models/user');
const { RideService } = require('./utils/ride-service');
const { RiderService } = require('./utils/rider-service');

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
        console.log("connection. socket.id:", socket.id);
        // console.log('riderList for Asbury Park upon connection', RiderService.getRiderList('Asbury Park').map(rider
        // => `${rider.fname} ${rider.lname}`));

        // Add admins to the room admins.
        socket.on('admin', token => {
          console.log("io.on('admins')");
          User.findByToken(token).then(user => {
            // console.log(`About to check if ${user.fname} ${user.lname} admin. Admin: ${user.admin}.`);
            if ( user.admin ) socket.join('admins');
          }).catch(err => {
            console.log("err:", err); // Todo: Handle error. Someone is pretending to be an admin.
          });
        });

        socket.on('giveMeAvailableRides', () => {
          console.log("socket.on('giveMeAvailableRides')");
          socket.emit('availableRides', RideService.getRides());
        });

        socket.on('joinRide', (user, ride, callback) => {
          console.log("socket.on('joinRide'). ride:", ride);
          socket.join(ride);

          let rider = RiderService.addRider(user, ride, socket.id);

          // Emits public info about the joinedRider to everybody on the ride.
          if ( rider.leader ) {
            socket.in(rider.ride).broadcast.emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone'))
          } else {
            socket.in(rider.ride).broadcast.emit('joinedRider', _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader'))
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
          console.log("socket.on('giveMeRiderList'). ride:", ride);
          let requestingRider = RiderService.getRider(socket.id);
          if ( requestingRider ) console.log("requestingRider:", requestingRider.fname, requestingRider.lname, "Leader:", requestingRider.leader);
          if ( !requestingRider ) console.log("The requesting rider was not found in riderList");
          if ( requestingRider ) {
            if ( requestingRider.leader || requestingRider.admin ) {
              socket.emit('riderList', RiderService.getRiderList(ride));
            } else {
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
          // console.log("socket.on('updateRiderPosition'). position:", position);
          // console.log("socket.id:", socket.id);
          let rider = RiderService.getRider(socket.id);
          console.log("socket.on('updateRiderPosition'). rider:", rider);
          RiderService.updateRiderPosition(rider);

          socket.in(rider.ride).emit('updatedRiderPosition', _.pick(rider, '_id', 'position'));
        });


        // socket.on('removeRider', () => {
        //   let rider = RiderService.getRider(socket.id);
        //   RiderService.removeRider(rider);
        //
        //   io.to(rider.ride).emit('removedRider', _.pick(rider, '_id'));
        //   socket.leave(rider.ride);
        // });

        // // For debugging.
        // socket.on('clearServerOfRiders', ride => {
        //   RiderService.removeAllRiders(ride);
        //   io.in(ride).emit('fullRiderList', []);
        // });

        socket.on('debugging', message => {
          console.log("debugging", message);
          io.in('admins').emit('debugging', message);
        });

        socket.on('disconnect', () => {
          console.log('disconnect. socket.id:', socket.id);
          let rider = RiderService.getRider(socket.id);

          if ( rider ) {
            RiderService.markAsDisconnected(rider);
            socket.in(rider.ride).emit('disconnectedRider', _.pick(rider, '_id', 'disconnected'));
            socket.leave(rider.ride);
          }


        });

      }
    )
    ;

  }
}

module.exports = { SocketServer };
