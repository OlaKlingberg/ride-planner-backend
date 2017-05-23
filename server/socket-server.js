const _ = require("underscore");

const { User } = require('./models/user');
const { RideService } = require('./utils/ride-service');
const { RiderService } = require('./utils/rider-service');

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
      console.log("connection. socket.id:", socket.id);

      // Add admins to the room admins.
      socket.on('admin', token => {
        console.log("io.on('admins')");
        User.findByToken(token).then(user => {
          console.log(`About to check if ${user.fname} ${user.lname} admin. Admin: ${user.admin}.`);
          if ( user.admin ) socket.join('admins');
        }).catch(err => {
          console.log("err:", err); // Todo: Handle error. Someone is pretending to be an admin.
        });
      });

      socket.emit('availableRides', RideService.getRides());

      socket.on('joinRide', (rider, callback) => {
        // Todo: Ideally, I should probably check the validity of the token here.
        console.log('joinRide. ride:', rider.ride);
        socket.join(rider.ride);
        RiderService.addRider(rider);

        // Send ride leaders' (and only ride leaders') phone numbers to all riders.
        if ( rider.leader ) {
          socket.in(rider.ride).broadcast.emit('newRider', _.omit(rider, 'email', 'emergencyName', 'emergencyPhone'));
        } else {
          io.in(rider.ride).broadcast.emit('newRider', _.omit(rider, 'email', 'phone', 'emergencyName', 'emergencyPhone'));
        }

        // Send full information to ride leaders.
        let rideLeaders = RiderService.getRideLeaders(rider.ride);
        rideLeaders.forEach(leader => {
          io.to(leader.socketId).emit('newRider', rider);
        });

        callback();
      });

      socket.on('leaveRide', rider => {
        // Todo: Ideally, I should probably check the validity of the token here.
        rider = RiderService.getRider(socket.id);
        if (rider) {
          console.log('leaveRide. ride:', rider.ride);
          socket.leave(rider.ride);
          RiderService.removeRider(rider);
          io.in(rider.ride).emit('removeRider', _.pick(rider, '_id'));
        }
      });


      socket.on('giveMeFullRiderList', rider => {
        console.log("rider.token", rider.token);
        User.findByToken(rider.token).then(user => {
          if ( user.leader ) {
            socket.emit('fullRiderList', RiderService.getFullRidersList(rider.ride));
          } else {
            socket.emit('fullRiderList', RiderService.getFullRidersListPublicInfo(rider.ride));
          }
        }).catch(err => {
          console.log("on giveMeFullRiderList. catch: No user was found! err:", err);  // Todo: Handle error.
        });

      });

      socket.on('updateRiderPosition', rider => {
        // Todo: Ideally, I should probably check the validity of the token here.
        let updatedRider = RiderService.updateRider(rider);
        io.in(updatedRider.ride).emit('updateRiderPosition', _.pick(updatedRider, '_id', 'lat', 'lng'));
      });


      socket.on('removeRider', rider => {
        rider = RiderService.removeRider(rider);

        io.to(rider.ride).emit('removeRider', _.pick(rider, '_id'));
        socket.leave(rider.ride);
      });

      // For debugging.
      socket.on('clearServerOfRiders', ride => {
        RiderService.removeAllRiders(ride);
        io.in(ride).emit('fullRiderList', []);
      });

      socket.on('debugging', message => {
        console.log("debugging", message);
        io.in('admins').emit('debugging', message);
      });

      socket.on('disconnect', () => {
        console.log('disconnect. socket.id:', socket.id);
        let rider = RiderService.getRider(socket.id);
        if (rider) {
          rider = RiderService.markAsDisconnected(rider);
          io.in(rider.ride).emit('disconnectedRider', _.pick(rider, '_id', 'disconnected', 'disconnectedTime'));
          socket.leave(rider.ride);
        }
      });

    });

  }
}

module.exports = { SocketServer };
