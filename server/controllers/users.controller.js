require('../config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { User } = require('../models/user');

const router = express.Router();

const { RiderService } = require('../utils/rider-service');

// Use JWT auth to secure the api
// const authenticateWithJwt = expressJwt({ secret: process.env.JWT_SECRET });

router.use(bodyParser.json());

// Routes
router.get('/', authenticate, getAllUsers);
router.post('/', registerNewUser);
router.post('/login', login);
router.get('/authenticate-by-token', authenticate, authenticateByToken);
router.delete('/logout', authenticate, logout);
router.get('/riders', authenticate, getAllRiders);  // Do I need this at all?


// Route handlers
function getAllUsers(req, res) {
  User.find({})
    .then(users => {
      res.send(users);
    }, (e) => {
      res.status(400).send(e);
    });
}

function registerNewUser(req, res) {
  const body = _.pick(req.body, ['fname', 'lname', 'phone', 'email', 'password', 'ename', 'ephone']);
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
  console.log("users.controller.login");
  console.log(`email:${req.body.email}.`);
  console.log(`password:${req.body.password}.`);
  User.findByCredentials(req.body.email, req.body.password)
    .then((user) => {
    console.log("user:", user);
      return user.generateAuthToken().then(token => {
        console.log("About to set token and send user.");
        res.set({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': ['x-auth', 'Access-Control-Allow-Origin'],
          'x-auth': token,
        }).send(user);
      });
    })
    .catch(() => {
      res.status(401).send('Username or password is incorrect');
    });
}

function authenticateByToken(req, res) {
  res.status(200).send(req.user);
}

function logout(req, res) {
  req.user.removeToken(req.token).then(() => {
    res.status(200).send();
  }, () => {
    res.status(400).send();
  });
}

function getAllRiders(req, res) {
  res.send(RiderService.getRiders('Asbury Park')); // Todo: Replace with variable -- if I need this function at all.
}

module.exports = router;
