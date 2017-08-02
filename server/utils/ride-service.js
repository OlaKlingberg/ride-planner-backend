// const rides = ['Rockland Lakes', 'Asbury Park'];

const { Ride } = require('../models/ride');

const RideService = {


  addRide: () => {

  },

  removeRide: () => {

  },

  // getRides: () => rides

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



