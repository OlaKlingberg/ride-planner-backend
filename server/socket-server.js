const socketio = require('socket.io');
const Rx = require("rxjs/Rx");
const _ = require("underscore");

let riders = [];
let riders$ = new Rx.BehaviorSubject(riders);

class SocketServer {

  startSocketServer(io) {
    let currentPrice = 0;

    // let riders = [];
    // let riders$ = new Rx.BehaviorSubject(riders);

    io.on('connection', (socket) => {
      console.log("io.on('connection')");

      riders$
        .auditTime(15000)
        .subscribe(riders => {
          io.emit('riderList', riders);
        });

      // Auction
      socket.emit('priceUpdate', currentPrice);
      socket.on('bid', function (data) {
        currentPrice = parseInt(data);
        socket.emit('priceUpdate', currentPrice);
        socket.broadcast.emit('priceUpdate', currentPrice);
      });

      // Rider Map 2
      socket.emit('riderList', riders);

      socket.on('rider', (newRider, callback) => {
        console.log("io.on('rider')");

        riders = riders.filter(rider => rider.email !== newRider.email);
        riders.push(_.pick(newRider, 'fname', 'lname', 'email', 'lat', 'lng'));

        socket.emit('riderList', riders);

        riders$.next(riders);
      });

      socket.on('removeRider', (user, callback) => {
        if (user) {
          riders = riders.filter(rider => rider.email !== user.email);
          io.emit('riderList', riders);
        }
      });
    });

  }
}


module.exports = { SocketServer, riders$ };