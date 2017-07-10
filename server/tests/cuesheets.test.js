const expect = require('expect');
const request = require('supertest');

const { ObjectID } = require('mongodb');

const { app } = require('./../server');

const { Cuesheet } = require('./../models/cuesheet');

const { users } = require('./seed/users.seed');
const { cuesheets, populateCuesheets } = require('./seed/cuesheets.seed');

beforeEach(populateCuesheets);

describe('GET /cuesheets', () => {

  it('should return all cuesheets if the user has a valid token', done => {
    request(app)
      .get('/cuesheets')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect(res => {
        expect(res.body.cuesheets.length).toBe(2);
        expect(res.body.cuesheets[0].name).toBe('TestCuesheet1')
      })
      .end(done);
  });

  it('should respond with a 401 if the user does not have a valid token', (done) => {
    request(app)
      .get('/cuesheets')
      .expect(401)
      .end(done);
  });
});

describe('POST /cuesheets', () => {
  const name = 'MyCuesheet1';
  const description = 'This is a cuesheet created by the test suite';
  const _creator = users[0]._id;

  it('should create a cuesheet', done => {
    request(app)
      .post('/cuesheets')
      .set('x-auth', users[0].tokens[0].token)
      .send({ name, description, _creator })
      .expect(200)
      .expect(res => {
        expect(res.body._id).toExist();
        expect(res.body.name).toBe(name);
      })
      .end(err => {
        if ( err ) {
          done(err);
          return;
        }

        Cuesheet.findOne({ name }).then(cuesheet => {
          expect(cuesheet).toExist();
          done();
        }).catch(e => done(e));
      });
  });

  it('should respond with a 401 if the user does not have a valid token', done => {
    request(app)
      .post('/cuesheets')
      .set('x-auth', users[0].tokens[0].token + 'X')
      .send({ name, description, _creator })
      .expect(401)
      .end(done);
  });

  it('should return validation errors if request invalid', done => {
    request(app)
      .post('/cuesheets')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        name,
        description,
      })
      .expect(400)
      .end(done);
  });

  it('should not create cuesheet if name in use', done => {
    request(app)
      .post('/cuesheets')
      .set('x-auth', users[0].tokens[0].token)
      .send({
        name: cuesheets[0].name,
        description,
        _creator
      })
      .expect(400)
      .end(done);
  });
});

describe('GET /cuesheets/:_id', () => {
  it('should return cuesheet doc', done => {
    request(app)
      .get(`/cuesheets/${cuesheets[0]._id.toHexString()}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect(res => {
        expect(res.body.cuesheet.name).toBe(cuesheets[0].name);
      })
      .end(done);
  });

  it('should return 404 if cuesheet not found', done => {
    request(app)
      .get(`/cuesheets/${new ObjectID().toHexString()}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done);
  });

  it('should return 404 for non-object ids', done => {
    request(app)
      .get('/cuesheets/123abc')
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done);
  });
});

describe('DELETE /cuesheets/:id', () => {
  it('should remove a cuesheet', done => {
    const hexId = cuesheets[1]._id.toHexString();

    request(app)
      .delete(`/cuesheets/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(200)
      .expect(res => {
        expect(res.body.cuesheet._id).toBe(hexId);
      })
      .end((err, res) => {
        if ( err ) {
          done(err);
          return;
        }

        Cuesheet.findById(hexId).then(cuesheet => {
          expect(cuesheet).toNotExist();
          done();
        }).catch(e => done(e));
      });
  });

  it('should return 404 if cuesheet not found', done => {
    request(app)
      .delete(`/cuesheets/${new ObjectID().toHexString()}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .end(done);
  });

  it('should return 404 if object id is invalid', done => {
    request(app)
      .delete(`/cuesheets/123`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .end(done);
  });
});

describe('PATCH /cuesheets/:_id', () => {
  it('should update the cuesheet info', done => {
    const hexId = cuesheets[0]._id.toHexString();
    const name = "TestCuesheet1 -- updated";

    request(app)
      .patch(`/cuesheets/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .send({ name })
      .expect(200)
      .expect(res => {
        expect(res.body.cuesheet.name).toBe(name);
      })
      .end(done);
  });
});
