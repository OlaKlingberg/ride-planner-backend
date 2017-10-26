require('../config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { User } = require('../models/user');
const { UserService } = require('../utils/user-service');

// const faker = require('faker');

const router = express.Router();

// const { RiderService } = require('../utils/rider-service');
// const { UserService } = require('../utils/user-service');

let dummyMembersTimer;


// Use JWT auth to secure the api
// const authenticateWithJwt = expressJwt({ secret: process.env.JWT_SECRET });

router.use(bodyParser.json());

// Routes
router.get('/', authenticate, getAllUsers);
router.post('/', registerNewUser);
router.post('/login', login);
router.get('/authenticate-by-token', authenticate, authenticateByToken);
router.get('/logout', authenticate, logout);
router.get('/add-dummy-members', authenticate, addDummyMembers);
router.get('/demo-users', getUnusedDemoUsers);


// Route handlers
function getAllUsers(req, res) {
  // Todo: Protect: Only admins (and ride leaders?) should be able to call this.
  User.find({})
    .then(users => {
      res.send({ users });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
}

function registerNewUser(req, res) {
  const body = _.pick(req.body, ['fname', 'lname', 'phone', 'email', 'password', 'emergencyName', 'emergencyPhone']);
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
  // console.log("ConnectedLoggedInUsers:", UserService.getConnectedLoggedInUsers());
  // console.log("req.host:", req.host);

  if ( UserService.isUserAlreadyLoggedInAndConnected(req.body.email) ) return res.status(401).send("You are already logged in on another device. Log out or close the browser window on that device before logging in here.");

  User.findByCredentials(req.body.email, req.body.password)
    .then((user) => {
      return user.generateAuthToken().then(token => {
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
  // console.log("authenticateByToken");
  res.status(200).send(req.user);
}

function logout(req, res) {
  // console.log("UsersController.logout");
  // console.log(req.token);
  req.user.removeToken(req.token).then(() => {
    res.status(200).send();
  }, () => {
    res.status(400).send();
  });
}

function addDummyMembers(req, res) {
  if ( dummyMembersTimer ) {
    clearTimeout(dummyMembersTimer);
  }

  User.addDummyMembers(req.user.email)
    .then(() => {

      // Remove all dummy members once no dummy members have been added for 1 hour.
      // Todo: Come up with a better strategy. This could still remove dummy riders while somebody is watching.
      dummyMembersTimer = setTimeout(() => {
        User.removeDummyMembers();
      }, 3600000);

      res.send();
    })
    .catch(e => {
      res.status(400).send(e);
    });
}

function getUnusedDemoUsers(req, res) {

  User.getDemoUsers()
    .then(demoUsers => {
      demoUsers = demoUsers.map(user => _.pick(user, 'email')['email']);

      let connectedLoggedInUsers = UserService.getConnectedLoggedInUsers()
        .map(user => _.pick(user, 'email')['email']);

      let unusedDemoUsers = _.difference(demoUsers, connectedLoggedInUsers);

      res.send(unusedDemoUsers);
    })
    .catch(e => {
      console.log(e);
      res.status(400).send(e);
    });
}

module.exports = router;
