const expect = require('expect');
const request = require('supertest');

const { ObjectID } = require('mongodb');

const { app } = require('./../server');

const { Ride } = require('./../models/ride');

const { users } = require('./seed/users.seed');
const { rides, populateRides } = require('./seed/rides.seed');

beforeEach(populateRides);

describe('POST /rides', () => {
  const name = 'MyNewRide';
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

describe('DELETE /rides/:_id', () => {
  it('should remove a ride if the user has a valid token', done => {
    const name = rides[0].name;

    request(app)
      .delete(`/rides/${name}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(200)
      .expect(res => {
        expect(res.body.ride.name).toBe(name);
      })
      .end((err, res) => {
        if (err ) {
          return done(err); // Todo: Does this work the same as putting return on the next line?
          // return;
        }

        Ride.findOne({ name })
          .then(ride => {
            expect(ride).toNotExist();
            done();
          })
          .catch(err => done(err));
      })
  });

  it('should respond with a 401 if the user does not have a valid token', done => {
    const rideId = rides[0]._id.toString();

    request(app)
      .delete(`/rides/${rideId}`)
      .set('x-auth', users[1].tokens[0].token + 'X')
      .expect(401)
      .end(done)
  });

  it('should return 404 if ride not found', done => {
    request(app)
      .delete(`/rides/${new ObjectID().toString()}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done);
  });

  it('should return 404 if objectID is invalid', done => {
    request(app)
      .delete('/rides/123')
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done);
  });

});







