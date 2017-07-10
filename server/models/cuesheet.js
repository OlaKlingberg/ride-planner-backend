const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
const cueSchema = require('./cue');

let CuesheetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  cues: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cue'
  }]
}, {
  timestamps: true
});


const Cuesheet = mongoose.model('Cuesheet', CuesheetSchema);

module.exports = { Cuesheet };