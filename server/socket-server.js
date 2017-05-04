const _ = require("underscore");

const { RideService } = require('./utils/ride-service');
const { RiderService } = require('./utils/rider-service');

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
      console.log("connection. socket.id:", socket.id);

      socket.emit('availableRides', RideService.getRides());

      socket.on('joinRide', ride => {
        console.log('joinRide. ride:', ride);
        socket.join(ride);

        let fullRiderList = RiderService.getFullRidersListPublicInfo(ride);
        socket.emit('fullRiderList', RiderService.getFullRidersListPublicInfo(ride));
      });

      socket.on('rider', (rider, callback) => {
        console.log(`on:rider: ${rider.fname} ${rider.lname}`);
        rider.socketId = socket.id;
        RiderService.addOrUpdateRider(rider);

        // console.log(`About to emit rider ${rider.fname} ${rider.lname} to riders on ride ${rider.ride}.`);
        io.in(rider.ride).emit('rider', _.pick(rider, '_id', 'ride', 'fname', 'lname', 'lat', 'lng'));
      });

      socket.on('removeRider', (rider, callback) => {
        console.log(`About to remove rider ${rider.fname} ${rider.lname} from ride ${rider.ride}`);
        RiderService.removeRider(rider);

        io.to(rider.ride).emit('removeRider', _.pick(rider, '_id'));
        socket.leave(rider.ride);
        callback();
      });

      socket.on('clearServerOfRiders', ride => {
        RiderService.removeAllRiders(ride);
        io.in(ride).emit('fullRiderList', []);
      });

      socket.on('disconnect', () => {
        console.log('disconnect. socket.id:', socket.id);
        let rider = RiderService.getRider(socket.id);

        if ( rider ) {
          RiderService.markAsDisconnected(rider);

          io.to(rider.ride).emit('disconnected', _.pick(rider, '_id'));
          socket.leave(rider.ride);
        }

      });

    });

  }
}

module.exports = { SocketServer };
