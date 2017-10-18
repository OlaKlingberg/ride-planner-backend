const { Ride } = require('../models/ride');

const RideService = {

  getRides: () => {
    Ride.find({})
      .then(rides => {
        return rides;
      }), (err) => {
      return err;
    }
  }

};

Object.freeze(RideService);
module.exports = { RideService };



