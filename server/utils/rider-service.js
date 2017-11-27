const _ = require('lodash');

let riderList = [];

const RiderService = {
  addRider: (user, ride, socketId) => {
    user.ride = ride;
    user.socketId = socketId;

    let idx = _.findIndex(riderList, ['_id', user._id]); // May or may not exist.

    // Todo: Can I simplify this with JSON.parse(JSON.stringify())?
    // Todo: I can no longer sort out the logic here. I don't know what I'm doing here.
    if ( idx >= 0 && riderList[idx].disconnected && (Date.now() - riderList[idx].disconnected < 5000) ) {
      // If the rider already exists, is disconnected, but has been disconnected for less than five seconds ...
      // Todo: Figure out: Why do I do exactly this, and only under those circumstances?
      riderList[idx].socketId = user.socketId;
      riderList[idx].disconnected = null;
      riderList[idx].position.timestamp = user.position.timestamp;
      riderList[idx].position.coords.accuracy = user.position.coords.accuracy;
      riderList[idx].position.coords.latitude = user.position.coords.latitude;
      riderList[idx].position.coords.longitude = user.position.coords.longitude;
    } else {
      // If the rider doesn't yet exist: add him. (Makes sense.)
      // If the rider is not disconnected, replace him (i.e. update him).
      // If the rider is disconnected and has been disconnected for more than five seconds. (Why?)
      riderList = riderList.filter(rider => rider._id !== user._id);
      riderList.push(user);
    }

    // console.log("riderList:");
    // riderList.forEach(rider => console.log(rider.fname, rider.lname, rider.socketId, rider.position));
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
      riderList[idx].position.timestamp = position.timestamp;
      riderList[idx].position.coords.accuracy = position.coords.accuracy;
      riderList[idx].position.coords.latitude = position.coords.latitude;
      riderList[idx].position.coords.longitude = position.coords.longitude;

      return riderList[idx];
    }

    return null;
  }

};

Object.freeze(RiderService);
module.exports = { RiderService };

