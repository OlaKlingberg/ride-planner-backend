const expect = require('expect');
const request = require('supertest');
const { ObjectID } = require('mongodb');

const { app } = require('./../server');
const { User } = require('./../models/user');
const { users, populateUsers } = require('./seed/seed');

beforeEach(populateUsers);

describe('GET /users', () => {
  it('should return all users if the user has a valid token', (done) => {
    request(app)
      .get('/users')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.users.length).toBe(2);
        expect(res.body.users[0].email).toBe('seed1@olaklingberg.com');
      })
      .end(done);
  });

  it('should respond with a 401 if the user does not have a valid token', (done) => {
    request(app)
      .get('/users')
      .expect(401)
      .end(done);
  });
});


describe('POST /users', () => {
  it('should create a user', (done) => {
    const fname = 'Tester1';
    const lname = 'LastName2';
    const email = 'example@example.com';
    const password = '123mnb!';

    request(app)
      .post('/users')
      .send({ fname, lname, email, password })
      .expect(200)
      .expect((res) => {
        expect(res.body._id).toExist();
        expect(res.body.email).toBe(email);
      })
      .end((err) => {
        if ( err ) done(err);

        User.findOne({ email }).then((user) => {
          expect(user).toExist();
          expect(user.password).toNotBe(password);
          done();
        }).catch((e) => done(e));
      });
  });

  it('should return validation errors if request invalid', (done) => {
    request(app)
      .post('/users')
      .send({
        email: 'and',
        password: '123'
      })
      .expect(400)
      .end(done);
  });

  it('should not create user if email in use', (done) => {
    request(app)
      .post('/users')
      .send({
        email: users[0].email,
        password: 'Whatever'
      })
      .expect(400)
      .end(done);
  });
});

describe('POST /users/login', () => {
  it('should respond with the user in the body and a token as an x-auth header', (done) => {
    request(app)
      .post('/users/login')
      .send({
        email: users[1].email,
        password: users[1].password
      })
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-auth']).toExist();
      })
      .end((err, res) => {
        if ( err ) done(err);

        User.findById(users[1])
          .then((user) => {
            expect(user.tokens[1]).toInclude({
              access: 'auth',
              token: res.headers['x-auth']
            });
            done();
          })
          .catch((e) => done(e));

      });
  });

  it('should reject invalid login', (done) => {
    request(app)
      .post('/users/login')
      .send({
        email: users[1].email,
        password: 'incorrect-password'
      })
      .expect(401)
      .expect((res) => {
        expect(res.body.email).toNotExist();
      })
      .end(done);
  });
});

describe('GET /users/authenticate-by-token', () => {
  it('should respond with a 200 if the user has a valid token', (done) => {
    request(app)
      .get('/users/authenticate-by-token')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .end(done);
  });

  it('should respond with a 401 if the user does not have a valid token', (done) => {
    request(app)
      .get('/users/authenticate-by-token')
      .set('x-auth', 'invalid mock token')
      .expect(401)
      .end(done);
  });

});

describe('DELETE /users/logout', () => {
  it('should remove auth token on logout', (done) => {
    request(app)
      .delete('/users/logout')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .end((err, res) => {
        if (err) done(err);

        User.findById(users[0]._id).then((user) => {
          expect(user.tokens.length).toBe(0);
          done();
        }).catch((e) => done(e));
      });
  });
});



