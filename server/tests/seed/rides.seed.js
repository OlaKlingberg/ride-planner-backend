const { ObjectID } = require('mongodb');

const { Ride } = require('./../../models/ride');

const userOneId = new ObjectID();
const userTwoId = new ObjectID();

const rideOneId = new ObjectID();
const rideTwoId = new ObjectID();

const rides = [{
  _id: rideOneId,
  name: 'MyRide1',
  description: 'This is the first ride created when seeding the database.',
  _creator: userOneId
}, {
  _id: rideTwoId,
  name: 'MyRide2',
  description: 'This is the second ride created when seeding the database.',
  _creator: userTwoId
}];

const populateRides = (done) => {
  Ride.remove({}).then(() => {
    const rideOne = new Ride(rides[0]).save();  // insertMany cannot be used here,
    const rideTwo = new Ride(rides[1]).save();  // because it wouldn't hash the passwords.

    return Promise.all([rideOne, rideTwo]);
  }).then(() => done());
};

module.exports = { rides, populateRides };