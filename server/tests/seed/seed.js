const { ObjectID } = require('mongodb');
const jwt = require('jsonwebtoken');

const { User } = require('./../../models/user');

const userOneId = new ObjectID();
const userTwoId = new ObjectID();
const users = [{
  _id: userOneId,
  email: 'seed1@olaklingberg.com',
  password: 'seedOnePass',
}, {
  _id: userTwoId,
  email: 'seed2@olaklingberg.com',
  password: 'seedTwoPass',
}];


const populateUsers = (done) => {
  User.remove({}).then(() => {
    const userOne = new User(users[0]).save();  // insertMany cannot be used here,
    const userTwo = new User(users[1]).save();  // because it wouldn't hash the passwords.

    return Promise.all([userOne, userTwo]);
  }).then(() => done());
};

module.exports = { users, populateUsers };