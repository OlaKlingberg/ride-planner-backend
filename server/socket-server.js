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
          if (user.admin) socket.join('admins');
        }).catch(err => {
          console.log("err:", err); // Todo: Handle error. Someone is pretending to be an admin.
        });
      });

      socket.emit('availableRides', RideService.getRides());

      socket.on('joinRide', ride => {
        console.log('joinRide. ride:', ride);
        socket.join(ride);
      });

      socket.on('giveMeFullRiderList', ({ride, token}) => {
        User.findByToken(token).then(user => {
          if (!user) return null; // Todo: What to do if no user if found? Is this even reachable?
          if (user.leader) {
            // console.log(`The user is a leader: ${user.fname} ${user.lname}. Leader: ${user.leader}`);
            socket.emit('fullRiderList', RiderService.getFullRidersList(ride));
          } else {
            // console.log(`The user is not a leader: ${user.fname} ${user.lname}. Leader: ${user.leader}`);
            RiderService.getFullRidersListPublicInfo(ride).forEach(rider => console.log(`${rider.fname} ${rider.lname}. ${rider.phone}`));
            socket.emit('fullRiderList', RiderService.getFullRidersListPublicInfo(ride));
          }
        }).catch(err => {
          console.log("on giveMeFullRiderList. catch: No user was found! err:", err);  // Todo: Handle error.
        });

      });

      socket.on('rider', ({rider, token}, callback) => {
        rider.socketId = socket.id;
        console.log(`${rider.fname} ${rider.lname}. ${rider.socketId}`);
        RiderService.addOrUpdateRider(rider);

        // Send ride leaders' (and only ride leaders') phone numbers to all riders.
        if (rider.leader) {
          io.in(rider.ride).emit('rider', _.omit(rider, 'email', 'emergencyName', 'emergencyPhone'));
        } else {
          io.in(rider.ride).emit('rider', _.omit(rider, 'email', 'phone', 'emergencyName', 'emergencyPhone'));
        }

        // Send full information to ride leaders.
        let rideLeaders = RiderService.getRideLeaders(rider.ride);
        rideLeaders.forEach(leader => {
          io.to(leader.socketId).emit('rider', rider);
        });
      });

      socket.on('removeRider', (rider, callback) => {
        console.log(`About to remove rider ${rider.fname} ${rider.lname} from ride ${rider.ride}`);
        RiderService.removeRider(rider);

        io.to(rider.ride).emit('removeRider', _.pick(rider, '_id'));
        socket.leave(rider.ride);
        callback();
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

        if ( rider ) {
          rider = RiderService.markAsDisconnected(rider);

          // Send ride leaders' (and only ride leaders') phone numbers to everybody.
          if (rider.leader) {
            io.in(rider.ride).emit('disconnectedRider', _.omit(rider, 'email', 'emergencyName', 'emergencyPhone'));
          } else {
            io.in(rider.ride).emit('disconnectedRider', _.omit(rider, 'email', 'email', 'phone', 'emergencyName', 'emergencyPhone'));
          }

          // Send full information to ride leaders.
          let rideLeaders = RiderService.getRideLeaders(rider.ride);
          rideLeaders.forEach(leader => {
            io.in(rider.ride).to(leader.socketId).emit('disconnectedRider', rider);
          });

          socket.leave(rider.ride);
        }

      });

    });

  }
}

module.exports = { SocketServer };
