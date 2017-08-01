const expect = require('expect');
const request = require('supertest');

const { ObjectID } = require('mongodb');

const { app } = require('./../server');

// const { Cuesheet } = require('./../models/cuesheet');
// const { Cue } = require('./../models/cue');

const { Ride } = require('./../models/ride');

const { users } = require('./seed/users.seed');
// const { cuesheets, cues, populateCuesheets } = require('./seed/cuesheets.seed');

describe('POST /rides', () => {
  const name = 'MyRide1';
  const description = 'This is a ride created by the test suite.';
  const _creator = users[0]._id;

  it('should create a ride if the user has a valid token', done => {
    request(app)
      .post('/rides')
      .set('x-auth', users[0].tokens[0].token)
      .send({name, description, _creator})
      .expect(200)
      .expect(res => {
        expect(res.body._id).toExist();
        expect(res.body.name).toBe(name);
      }).end(err => {
        if (err ) {
          done(err);
          return;
        }

        Ride.findOne({ name }).then(ride => {
          expect(ride).toExist();
          done();
        }).catch(e => done(e));
    })
  });

  it('should respond with a 401 if the user does not have a valid token', done => {
    request(app)
      .post('/rides')
      .set('x-auth', users[0].tokens[0].token + 'X')
      .send({ name, description, _creator })
      .expect(401)
      .end(done);
  });

  it('should return validation errors if request invalid', done => {
    request(app)
      .post('/rides')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        name,
        description,
      })
      .expect(400)
      .end(done);
  });




});





