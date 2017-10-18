const mongoose = require('mongoose');
const validator = require('validator');
// const jwt = require('jsonwebtoken');
const _ = require('lodash');
// const bcrypt = require('bcryptjs');

let RideSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
}, {
  timestamps: true
});



RideSchema.statics.getRides = function () {
  const Ride = this;

  return Ride.find({});
};


// const Ride = mongoose.model('Ride', RideSchema);
const Ride = mongoose.model(`${process.env.DB_PREFIX}Ride`, RideSchema);

module.exports = { Ride };
