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
          socket.join('admins');
        }).catch(err => {
          console.log("err:", err); // Todo: How do I want to handle this error?
        });
      });

      socket.emit('availableRides', RideService.getRides());

      socket.on('joinRide', ride => {
        console.log('joinRide. ride:', ride);
        socket.join(ride);
      });

      socket.on('giveMeFullRiderList', ride => {
        let fullRiderList = RiderService.getFullRidersListPublicInfo(ride);
        socket.emit('fullRiderList', RiderService.getFullRidersListPublicInfo(ride));
      });

      socket.on('rider', (rider, callback) => {
        // console.log(`on:rider: ${rider.fname} ${rider.lname}`);
        rider.socketId = socket.id;
        RiderService.addOrUpdateRider(rider);

        io.in(rider.ride).emit('rider', _.omit(rider, 'email'));
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
        io.in('admins').emit('debugging', message);
      });

      socket.on('disconnect', () => {
        console.log('disconnect. socket.id:', socket.id);

        let rider = RiderService.getRider(socket.id);

        if ( rider ) {
          RiderService.markAsDisconnected(rider);
          rider.disconnected = true;

          io.to(rider.ride).emit('disconnectedRider', _.omit(rider, 'email'));
          socket.leave(rider.ride);
        }

      });

    });

  }
}

module.exports = { SocketServer };
