require('../config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { User } = require('../models/user');
// const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// Use JWT auth to secure the api
const authenticate = expressJwt({ secret: process.env.JWT_SECRET});

router.use(bodyParser.json());

// Routes
router.post('/', register);
router.get('/me', authenticate, getCurrentUser);
router.post('/login', login);
router.delete('/me/token', authenticate, deleteUser);


// Route handlers
function register(req, res) {
  const body = _.pick(req.body, ['email', 'password']);
  const user = new User(body);

  user.save().then(() => {
    return user.generateAuthToken();
  }).then((token) => {
    res.header('x-auth', token).send(user); // x- denotes a custom header, not part of the HTTP standard.
  }).catch((e) => {
    res.status(400).send(e);
  });
}

function getCurrentUser(req, res) {
  res.send(req.user);
}

function login(req, res) {
  const body = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(body.email, body.password).then((user) => {
    return user.generateAuthToken().then((token) => {
      res.header('x-auth', token).send(user);
    });
  }).catch((e) => {
    res.status(400).send();
  });
}

function deleteUser (req, res) {
  req.user.removeToken(req.token).then(() => {
    res.status(200).send();
  }, () => {
    res.status(400).send();
  });
}

module.exports = router;
