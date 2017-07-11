const { ObjectID } = require('mongodb');

const { Cue } = require('./../../models/cue');
const { Cuesheet } = require('./../../models/cuesheet');

const userOneId = new ObjectID();
const userTwoId = new ObjectID();

const cuesheetOneId = new ObjectID();
const cuesheetTwoId = new ObjectID();

const cueOneId = new ObjectID();
const cueTwoId = new ObjectID();

const cuesheets = [{
  _id: cuesheetOneId,
  name: 'TestCuesheet1',
  description: 'This is the test cuesheet 1',
  _creator: userOneId,
  cues: [],
  createdAt: Date(),
  updatedAt: Date()
}, {
  _id: cuesheetTwoId,
  name: 'TestCuesheet2',
  description: 'This is the test cuesheet 2',
  _creator: userTwoId,
  cues: [],
  createdAt: Date(),
  updatedAt: Date()
}];

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

const populateCuesheets = (done) => {
  Cuesheet.remove({})
    .then(() => Cue.remove({}))
    .then(() => Cuesheet.insertMany(cuesheets))
    .then(() => Cue.insertMany(cues))
    .then(() => Cuesheet.findById(cuesheets[0]._id))
    .then(cuesheet => {
      cuesheet.cues.push(cues[0]._id);
      cuesheet.cues.push(cues[1]._id);
      return cuesheet.save();
    })
    .then(() => done())
    .catch(e => console.log(e));
};

module.exports = { cuesheets, cues, populateCuesheets };

