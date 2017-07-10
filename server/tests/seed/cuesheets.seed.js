const { ObjectID } = require('mongodb');

const { Cuesheet } = require('./../../models/cuesheet');

const userOneId = new ObjectID();
const userTwoId = new ObjectID();

const cuesheetOneId = new ObjectID();
const cuesheetTwoId = new ObjectID();
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

const populateCuesheets = (done) => {
  Cuesheet.remove({}).then(() => {

    return Cuesheet.insertMany(cuesheets);
  }).then(() => done());
};

module.exports = { cuesheets, populateCuesheets };