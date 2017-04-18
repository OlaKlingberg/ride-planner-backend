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

      socket.on('newRider', (newRider, callback) => {
        console.log("io.on('newRider')");
        riders.push(newRider);
        io.emit('updateRiders', riders);
        callback();
      });


    });

  }
};
