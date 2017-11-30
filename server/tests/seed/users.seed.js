const { ObjectID } = require('mongodb');
const jwt = require('jsonwebtoken');

const { User } = require('./../../models/user');

const userOneId = new ObjectID();
const userTwoId = new ObjectID();
const users = [{
  _id: userOneId,
  fname: 'Seed1',
  lname: 'TestUser1',
  email: 'seed1@olaklingberg.com',
  password: 'seedOnePass',
  tokens: [{
    access: 'auth',
    token: jwt.sign({_id: userOneId, access: 'auth'}, process.env.JWT_SECRET)
  }]
}, {
  _id: userTwoId,
  fname: 'Seed2',
  lname: 'TestUser2',
  email: 'seed2@olaklingberg.com',
  password: 'seedTwoPass',
  tokens: [{
    access: 'auth',
    token: jwt.sign({_id: userTwoId, access: 'auth'}, process.env.JWT_SECRET)
  }]
}];

const populateUsers = (done) => {
  User.remove({}).then(() => {
    const userOne = new User(users[0]).save();  // insertMany cannot be used here,
    const userTwo = new User(users[1]).save();  // because it wouldn't hash the passwords.

    return Promise.all([userOne, userTwo]);
  }).then(() => done());
};

module.exports = { users, populateUsers };