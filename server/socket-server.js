const socketio = require('socket.io');

module.exports = class SocketServer {
  startSocketServer(io) {
    let currentPrice = 0;

    let riders = [];


    io.on('connection', (socket) => {
      console.log("io.on('connection')");
      socket.emit('priceUpdate',currentPrice);
      socket.on('bid', function (data) {
        currentPrice = parseInt(data);
        socket.emit('priceUpdate',currentPrice);
        socket.broadcast.emit('priceUpdate',currentPrice);
      });

      socket.on('newRider', (newRiderMarker, callback) => {
        console.log("io.on('newRider')");
        console.log(socket.id);
        riders.push(newRiderMarker);
        console.log(riders);
        io.emit('updateRidersArray', riders);
        callback();
      });


    });

  }
};
