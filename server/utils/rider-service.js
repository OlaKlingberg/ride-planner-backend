const _ = require('lodash');

let riders = [];

const RiderService = {
  addRider: riderToAdd => {
    riders = riders.filter(rider => rider.email !== riderToAdd.email);
    riders.push(riderToAdd);

    return riders;
  },

  removeRider: socketId => {
    let ride;
    let rider = riders.find(rider => rider.socketId === socketId);

    if (rider) ride = rider.ride;

    riders = riders.filter(rider => rider.socketId !== socketId);

    return ride;
  },

  getRiders: (ride) => {
    return riders.filter(rider => rider.ride === ride);
  },

  getRidersPublic: (ride) => {
    let ridersOnRide = riders.filter(rider => rider.ride === ride);
    return ridersOnRide.map(rider => _.pick(rider, 'fname', 'lname', 'socketId', 'lat', 'lng'));
  },

};

Object.freeze(RiderService);
module.exports = { RiderService };

