const socketio = require('socket.io');
const Rx = require("rxjs/Rx");
const _ = require("underscore");

const { RideService } = require('./utils/ride-service');
const { RiderService } = require('./utils/rider-service');

class SocketServer {

  startSocketServer(io) {

    io.on('connection', (socket) => {
      console.log("Connection! socket.id:", socket.id);
      socket.emit('rides', RideService.getRides());
      socket.emit('riderList', RiderService.getRidersPublic());

      RiderService.getRidersPublic$()
        // .auditTime(10000)
        .subscribe(riders => {
          io.emit('riderList', riders);
        });

      socket.on('rider', (newRider, callback) => {
        console.log("rider:", newRider);
        RiderService.addRider(newRider, socket.id);

        socket.emit('riderList', RiderService.getRidersPublic());
        // callback();
      });

      socket.on('removeRider', () => {
        console.log('removeRider');
        RiderService.removeRider(socket.id);
        // callback();
      });

      socket.on('disconnect', () => {
        console.log("Disconnected:", socket.id);
        // RiderService.removeRider(socket.id);
      })

    });

  }
}


module.exports = { SocketServer };
