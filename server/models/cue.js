const mongoose = require('mongoose');
const _ = require('lodash');

let CueSchema = new mongoose.Schema({
  distance: {
    type: Number,
    required: true
  },
  turn: {
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
  comment: {
    type: String,
    required: false
  },
  lat: {
    type: Number,
    required: false
  },
  lng: {
    type: Number,
    required: false
  }
}, {
  timestamps: true
});

const Cue = mongoose.model('Cue', CueSchema);

module.exports = { Cue };

