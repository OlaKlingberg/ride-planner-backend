const socketio = require('socket.io');
const Rx = require("rxjs/Rx");
const _ = require("underscore");

// let riders = [];
let riders$ = new Rx.BehaviorSubject([]);

class SocketServer {

  startSocketServer(io) {
    let currentPrice = 0;

    io.on('connection', (socket) => {
      console.log("io.on('connection'). socket.id:", socket.id);

      riders$
        .auditTime(15000)
        .subscribe(riders => {
          io.emit('riderList', riders);
        });

      // Auction
      // socket.emit('priceUpdate', currentPrice);
      // socket.on('bid', function (data) {
      //   currentPrice = parseInt(data);
      //   socket.emit('priceUpdate', currentPrice);
      //   socket.broadcast.emit('priceUpdate', currentPrice);
      // });

      // Rider Map 2
      socket.emit('riderList', riders$.value);

      socket.on('rider', (newRider, callback) => {
        console.log("io.on('rider')");

        let riders = riders$.value.filter(rider => rider.email !== newRider.email);
        riders.push(_.pick(newRider, 'fname', 'lname', 'email', 'lat', 'lng'));
        riders$.next(riders);
        socket.emit('riderList', riders);

      });

      socket.on('removeRider', (user, callback) => {
        if (user) {
          let riders = riders$.value.filter(rider => rider.email !== user.email);
          riders$.next(riders);
          io.emit('riderList', riders);
        }
      });
    });

  }
}


module.exports = { SocketServer, riders$ };