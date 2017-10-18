const mongoose = require('mongoose');
// const validator = require('validator');
// const jwt = require('jsonwebtoken');
const _ = require('lodash');
// const bcrypt = require('bcryptjs');

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

const Cue = mongoose.model(`${process.env.DB_PREFIX}Cue`, CueSchema);

module.exports = { Cue };

