const socketio = require('socket.io');

module.exports = class SocketServer {
  startSocketServer(io) {
    let currentPrice = 0;

    let riders = [];

    io.on('connection', (socket) => {
      console.log("io.on('connection')");

      // Auction
      socket.emit('priceUpdate',currentPrice);
      socket.on('bid', function (data) {
        currentPrice = parseInt(data);
        socket.emit('priceUpdate',currentPrice);
        socket.broadcast.emit('priceUpdate',currentPrice);
      });

      // Rider Map 2
      socket.emit('newRiderList', riders);

      socket.on('newRider', (newRider, callback) => {
        console.log("io.on('newRider')");
        riders.push(newRider);
        io.emit('newRiderList', riders);
        console.log(riders);
        callback();
      });

      socket.on('removeRider', (user, callback) => {
        console.log('removeRider. About to remove', user);
        // console.log(user);
        console.log(riders);
        riders = riders.filter(rider => rider.email !== user.email);
        console.log('removeRider. Should have removed');
        console.log(riders);
        io.emit('newRiderList', riders);
      });


    });

  }
};
