const expect = require('expect');
const request = require('supertest');

const { ObjectID } = require('mongodb');

const { app } = require('./../server');

const { Cuesheet } = require('./../models/cuesheet');
const { Cue } = require('./../models/cue');

const { users } = require('./seed/users.seed');
const { cuesheets, cues, populateCuesheets } = require('./seed/cuesheets.seed');

const cue = {
  _id: new ObjectID(),
  turn: 'Straight',
  description: "Across the plaza.",
  distance: 3.3,
  lat: 40.30,
  lng: -74.31,
  createdAt: Date(),
  updatedAt: Date(),
};

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
  it('should remove a cuesheet and the cues belonging to that cuesheet', done => {
    const hexId = cuesheets[0]._id.toHexString(); // .toString() seems to work just as well. Why .toHexString()?

    request(app)
      .delete(`/cuesheets/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(200)
      .expect(res => {
        console.log("cues that should have been deleted:", res.body.cuesheet.cues);
        expect(res.body.cuesheet._id).toBe(hexId);
      })
      .end((err, res) => {
        if ( err ) {
          return done(err); // Todo: Does this work the same as putting return on the next line?
          // return;
        }

        Cuesheet.findById(hexId)
          .then(cuesheet => {
            expect(cuesheet).toNotExist();
            return Cue.findById(cues[0]._id.toString())
          })
          .then(cue => {
            expect(cue).toNotExist();
            done();
          })
          .catch(e => done(e));
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

describe('POST /cuesheets/cues', () => {
  const cuesheetId = cuesheets[0]._id;

  it('should create a cue and add cue._id to the end of cuesheet.cues', done => {
    request(app)
      .post('/cuesheets/cues')
      .set('x-auth', users[0].tokens[0].token)
      .send({ cuesheetId, cue })
      .expect(200)
      .end(err => {
        if ( err ) {
          done(err);
          return;
        }

        Cuesheet.findById(cuesheetId).then(cuesheet => {
          expect(cuesheet.cues.length).toBe(3);
          expect(cuesheet.cues[2].toString()).toBe(cue._id.toString());
          done();
        }).catch(e => done(e));

      })
  });

  it('should create a cue and insert cue._id at the correct place in cuesheet.cues', done => {
    request(app)
      .post('/cuesheets/cues')
      .set('x-auth', users[0].tokens[0].token)
      .send({ cuesheetId, cue, insertBeforeId: cues[1]._id })
      .expect(200)
      .end(err => {
        if ( err ) {
          return done(err);
          // return;
        }

        Cuesheet.findById(cuesheetId).then(cuesheet => {
          expect(cuesheet.cues.length).toBe(3);
          expect(cuesheet.cues[1].toString()).toBe(cue._id.toString());
          done();
        }).catch(e => done(e));

      })
  });


});

describe('DELETE /cuesheets/:cuesheetId/cues/:cueId', () => {
  const cuesheetHexId = cuesheets[0]._id.toHexString();
  const cueHexId = cues[0]._id.toHexString();
  console.log("cuesheetHexId:", cuesheetHexId);
  console.log("cueHexId:", cueHexId);

  it('should delete a cue and delete the reference from the cuesheet XXX', done => {
    request(app)
      .delete(`/cuesheets/${cuesheetHexId}/cues/${cueHexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect(res => {
        expect(res.body.cue._id).toBe(cueHexId);
      })
      .end((err, res) => {
        if ( err ) {
          done(err);
          return;
        }

        Cuesheet.findById(cuesheetHexId).then(cuesheet => {
          // console.log("cuesheet, from which one cue should have been deleted:", cuesheet);
          expect(cuesheet.cues.length).toBe(1);
          expect(cuesheet.cues[0].toHexString()).toNotBe(cueHexId);

          // Todo: Is this nesting a good idea, or is there a better way?
          Cue.findById(cueHexId).then(cue => {
            expect(cue).toNotExist();
            done();
          });
        }).catch(e => done(e));


      })
  })

});
