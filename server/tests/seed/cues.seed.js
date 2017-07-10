const { ObjectID } = require('mongodb');

const { Cue } = require('./../../models/cue');
const { Cuesheet } = require('./../../models/cuesheet');

const { cuesheets, populateCuesheets } = require('./cuesheets.seed');

const cueOneId = new ObjectID();
const cueTwoId = new ObjectID();

const cues = [{
  _id: cueOneId,
  turn: 'Left',
  description: "Into First Street",
  distance: 1.1,
  lat: 40.20,
  lng: -74.01,
  createdAt: Date(),
  updatedAt: Date(),
}, {
  _id: cueTwoId,
  turn: 'Right',
  description: "Into Second Street",
  distance: 2.2,
  lat: 40.21,
  lng: -74.02,
  createdAt: Date(),
  updatedAt: Date(),
}];

const populateCues = (done) => {
  Cue.remove({})
    .then(() => Cue.insertMany(cues))
    .then(() => Cuesheet.findById(cuesheets[0]._id))
    .then(cuesheet => {
      cuesheet.cues.push(cues[0]._id);
      cuesheet.cues.push(cues[1]._id);
      return cuesheet.save();
    })
    .then(cuesheet => Cuesheet.findById(cuesheet._id))
    .then(() => done())
    .catch(e => console.log(e));
};


module.exports = { cues, populateCues };