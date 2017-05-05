const _ = require('lodash');

let riders = [];

const RiderService = {
  addOrUpdateRider: riderToAddOrRemove => {
    riders = riders.filter(rider => rider._id !== riderToAddOrRemove._id);
    riders.push(riderToAddOrRemove);
  },

  removeRider: riderToRemove => {
    riders = riders.filter(rider => rider._id !== riderToRemove._id);
  },

  removeAllRiders: ride => {
    riders = riders.filter(rider => rider.ride !== ride);
  },

  getRider: socketId => {
    return riders.find(rider => rider.socketId === socketId);
  },

  markAsDisconnected: disRider => {
    let index = _.findIndex(riders, rider => rider._id === disRider._id);
    if ( index >= 0 ) {
      riders[index].disconnected = true;
    }
  },

  getFullRidersList: (ride) => {
    return riders.filter(rider => rider.ride === ride);
  },

  getFullRidersListPublicInfo: (ride) => {
    let onRide = riders.filter(rider => rider.ride === ride);
    return onRide.map(rider => _.omit(rider, 'email'));
  },

};

Object.freeze(RiderService);
module.exports = { RiderService };

