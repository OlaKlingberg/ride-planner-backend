// const socketio = require('socket.io');
const _ = require("underscore");

const { RideService } = require('./utils/ride-service');
const { RiderService } = require('./utils/rider-service');

let counter = 0;

class SocketServer {
  startSocketServer(io) {

    io.on('connection', (socket) => {
      socket.emit('availableRides', RideService.getRides());

      socket.on('rider', (rider, callback) => {
        rider.socketId = socket.id;
        let ride = rider.ride;

        RiderService.addRider(rider);
        socket.join(ride);
        io.to(ride).emit('riderList', RiderService.getRidersPublic(ride));

      });

      socket.on('removeRider', (rider, callback) => {
        let ride = RiderService.removeRider(socket.id);

        if ( ride ) {
          socket.broadcast.to(ride).emit('riderList', RiderService.getRidersPublic(ride));
          socket.emit('riderList', null);
          socket.leave(ride);
        }
      });

      socket.on('disconnect', () => {
        let ride = RiderService.removeRider(socket.id);
        if ( ride ) {
          socket.broadcast.to(ride).emit('riderList', RiderService.getRidersPublic(ride));
          socket.emit('riderList', null);
          socket.leave(ride);
        }
      });

    });

  }
}

module.exports = { SocketServer };
