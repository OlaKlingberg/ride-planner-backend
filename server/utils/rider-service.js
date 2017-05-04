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

  getRider: socketId => {
    return riders.find(rider => rider.socketId === socketId);
  },

  markAsDisconnected: riderToMarkAsDisconnected => {
    let index = _.findIndex(riders, rider => rider._id === riderToMarkAsDisconnected._id);
    if ( index >= 0 ) {
      riders[index].disconnected = true;

    }
  },

  getFullRidersList: (ride) => {
    return riders.filter(rider => rider.ride === ride);
  },

  getFullRidersListPublicInfo: (ride) => {
    let onRide = riders.filter(rider => rider.ride === ride);
    let toReturn = onRide.map(rider => _.pick(rider, 'fname', 'lname'));
    console.log(toReturn);
    return onRide.map(rider => _.pick(rider, '_id', 'ride', 'fname', 'lname', 'lat', 'lng'));
  },

};

Object.freeze(RiderService);
module.exports = { RiderService };

