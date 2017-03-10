require('../config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { User } = require('../models/user');

const router = express.Router();

// Use JWT auth to secure the api
const authenticateWithJwt = expressJwt({ secret: process.env.JWT_SECRET });

router.use(bodyParser.json());

// Routes
router.post('/', register);
router.post('/login', login);


// Route handlers
function register(req, res) {
  const body = _.pick(req.body, ['email', 'password']); // Is there anything else on req.body?
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
  const body = _.pick(req.body, ['email', 'password']); // Is there anything else on req.body?

  User.findByCredentials(body.email, body.password)
    .then((user) => {
      let token = user.generateAuthToken();
      user.token = token;
      res.send(_.pick(user, ['_id', 'email', 'token']));
    })
    .catch((e) => {
      res.status(400).send(e);
    });
}

module.exports = router;
