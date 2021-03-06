const _ = require('lodash');

let riderList = [];

const RiderService = {
  addRider: (user, ride, socketId) => {
    user.ride = ride;
    user.socketId = socketId;

    let idx = _.findIndex(riderList, ['_id', user._id]); // May or may not exist.

    // Todo: Why exactly do I check if the user has been disconnected for less than five seconds?
    if ( idx >= 0 && riderList[idx].disconnected && (Date.now() - riderList[idx].disconnected < 5000) ) {
      // If the rider already exists, is disconnected, but has been disconnected for less than five seconds ...
      // Todo: Figure out: Why do I do exactly this, and only under those circumstances?
      riderList[idx].socketId = user.socketId;
      riderList[idx].disconnected = null;
      riderList[idx].position = JSON.parse(JSON.stringify(user.position));
    } else {
      riderList = riderList.filter(rider => rider._id !== user._id);
      riderList.push(user);
    }

    return user;
  },


  getPublicRiderList: (ride) => {
    let list = riderList.filter(rider => rider.ride === ride);
    return list.map(rider => {
      if ( rider.leader ) {
        return _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader', 'phone')
      } else {
        return _.pick(rider, '_id', 'fname', 'lname', 'disconnected', 'position', 'leader')
      }
    });
  },

  getRider: socketId => {
    return riderList.find(rider => rider.socketId === socketId);
  },

  getRideLeaders: ride => {
    return riderList.filter(rider => (rider.ride === ride) && rider.leader);
  },

  getRiderList: (ride) => {
    return riderList.filter(rider => rider.ride === ride);
  },

  markAsDisconnected: disRider => {
    let idx = _.findIndex(riderList, rider => rider._id === disRider._id);
    if ( idx >= 0 ) {
      riderList[idx].disconnected = Date.now();
    }
  },

  removeRider: riderToRemove => {
    riderList = riderList.filter(rider => rider._id !== riderToRemove._id);
  },

  updateRiderPosition: (socketId, position) => {
    let idx = _.findIndex(riderList, rider => rider.socketId === socketId);

    if ( idx >= 0 ) {
      riderList[idx].position = JSON.parse(JSON.stringify(position));

      return riderList[idx];
    }

    return null;
  }
};

Object.freeze(RiderService);
module.exports = { RiderService };

