const mongoose = require('mongoose');
const _ = require('lodash');

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

const Ride = mongoose.model('Ride', RideSchema);

module.exports = { Ride };

