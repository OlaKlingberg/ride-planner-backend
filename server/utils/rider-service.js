const _ = require('lodash');

let riderList = [];

const RiderService = {
  addRider: (user, ride, socketId) => {
    user.ride = ride;
    user.socketId = socketId;

    // Todo: Make this unnecessary. I believe it is now
    if ( !user.position ) console.log("-------------------------- This should never happen! --------------------------");

    let idx = _.findIndex(riderList, ['_id', user._id]); // May or may not exist.

    if ( idx >= 0 && riderList[idx].disconnected && (Date.now() - riderList[idx].disconnected < 5000) ) {
      riderList[idx].socketId = user.socketId;
      riderList[idx].disconnected = null;
      riderList[idx].position.timestamp = user.position.timestamp;
      riderList[idx].position.coords.accuracy = user.position.coords.accuracy;
      riderList[idx].position.coords.latitude = user.position.coords.latitude;
      riderList[idx].position.coords.longitude = user.position.coords.longitude;
    } else {
      if (riderList[idx]) console.log("Disconnected:", riderList[idx].disconnected);
      riderList = riderList.filter(rider => rider._id !== user._id);
      riderList.push(user);
    }

    return user;
  },

  removeRider: riderToRemove => {
    riderList = riderList.filter(rider => rider._id !== riderToRemove._id);
  },

  updateRiderPosition: riderToUpdate => {
    let idx = _.findIndex(riderList, rider => rider._id === riderToUpdate._id);

    riderList[idx].position.timestamp = riderToUpdate.position.timestamp;
    riderList[idx].position.coords.accuracy = riderToUpdate.position.coords.accuracy;
    riderList[idx].position.coords.latitude = riderToUpdate.position.coords.latitude;
    riderList[idx].position.coords.longitude = riderToUpdate.position.coords.longitude;
  },

  getRider: socketId => {
    // console.log("riderList:", riderList);
    return riderList.find(rider => rider.socketId === socketId);
  },

  markAsDisconnected: disRider => {
    let idx = _.findIndex(riderList, rider => rider._id === disRider._id);
    if ( idx >= 0 ) {
      riderList[idx].disconnected = Date.now();
    }
  },

  getRiderList: (ride) => {
    return riderList.filter(rider => rider.ride === ride);
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

  getRideLeaders(ride) {
    return riderList.filter(rider => (rider.ride === ride) && rider.leader);
  }

};

Object.freeze(RiderService);
module.exports = { RiderService };

