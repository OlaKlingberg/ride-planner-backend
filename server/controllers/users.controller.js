require('../config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { User } = require('../models/user');

const router = express.Router();

// Use JWT auth to secure the api
// const authenticateWithJwt = expressJwt({ secret: process.env.JWT_SECRET });

router.use(bodyParser.json());

// Routes
router.post('/', registerNewUser);
router.post('/login', login);


// Route handlers
function registerNewUser(req, res) {
  const body = _.pick(req.body, ['fname', 'lname', 'email', 'password']);
  const user = new User(body);

  user.save()
    .then(() => {
      res.send(user)
    })
    .catch((e) => {
      res.status(400).send(e);
    });
}

function login(req, res) {
  User.findByCredentials(req.body.email, req.body.password)
    .then((user) => {
      return user.generateAuthToken().then((token) => {
        res.set({
          'Access-Control-Expose-Headers': 'x-auth',
          'x-auth': token,
        }).send(user);
      });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
}

module.exports = router;
