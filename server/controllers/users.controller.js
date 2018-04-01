require('../config/config');
const { ObjectID } = require('mongodb');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
// const sgMail = require('@sendgrid/mail');
const sgMail = require('@sendgrid/mail');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { User } = require('../models/user');
const { UserService } = require('../utils/user-service');

const router = express.Router();

let dummyMembersTimer;

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

router.use(bodyParser.json());

// Routes
router.get('/', authenticate, getAllUsers);
router.post('/', registerNewUser);
router.post('/login', login);
router.get('/authenticate-by-token', authenticate, authenticateByToken);
router.get('/logout', authenticate, logout);
router.get('/add-dummy-members', authenticate, addDummyMembers);
router.get('/delete-dummy-members', authenticate, deleteDummyMembers);
router.get('/demo-users', getUnusedDemoUsers);
router.get('/:_id', authenticate, getUser);
router.patch('/update', authenticate, updateMember);
router.post('/reset-password-request', resetPasswordRequest);
router.post('/reset-password', resetPassword);

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
  console.log("login()");
  if ( UserService.isUserAlreadyLoggedInAndConnected(req.body.email) ) return res.status(401).send("You are already logged in on another device. Log out or close the browser window on that device before logging in here.");

  User.findByCredentials(req.body.email, req.body.password)
    .then((user) => {
      return user.generateAuthToken().then(token => { // Todo: Why do I return this?
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

function deleteDummyMembers(req, res) {
  User.removeDummyMembers()
    .then(() => {
      res.send("This is the response!");
    })
    .catch(e => {
      console.log(e);
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

function getUser(req, res) {
  const _id = req.params._id;

  User.findOne({ _id })
    .then(user => {
      res.send({ user });
    })
    .catch(err => {
      res.status(400).send(err);
    });
}

function updateMember(req, res) {
  const userId = req.user._id;
  if ( !ObjectID.isValid(userId) ) return res.status(404).send();

  let member = _.pick(req.body, ['_id', 'admin', 'leader', 'fname', 'lname', 'email', 'phone', 'emergencyName', 'emergencyPhone']);

  User.findOne({ _id: userId })
    .then(user => {

      // If the user is not the superAdmin, then the user can not change the member's admin status.
      if ( user.email !== process.env.SUPER_ADMIN ) {
        delete member.admin;
      }

      // If the user is not an admin, then the user can not change the member's leader status.
      if ( !user.admin ) {
        delete member.leader;
      }

      // If the user is not the member, then the user can not change the member's general info.
      if ( userId !== member._id ) {
        delete member.fname;
        delete member.lname;
        delete member.email;
        delete member.phone;
        delete member.emergencyPhone;
        delete member.emergencyName;
      }

      // Todo: Why findOneAndUpdate? I already have the user.
      User.findOneAndUpdate({ _id: member._id }, { $set: member }, { new: true }).then(member => {
        if ( !member ) return member.status(404).send();

        return res.send(member);
      })

    }).catch(err => {
    res.status(400).send(err);
  });
}

function resetPasswordRequest(req, res) {
  console.log("resetPasswordRequest()");
  const email = req.body.email;
  const host = req.body.host;
  User.findOne({ email })
    .then(user => {
      if ( user ) {
        user.generatePasswordResetToken()
          .then(token => {
            const resetUrl = `http://${host}/auth/password-reset?email=${email}&token=${token}`;
            const msg = {
              to: email,
              from: 'noreply@olaklingberg.com',
              subject: 'RidePlanner Password Reset',
              html: `Did you just request to have your RidePlanner password reset? If so, click on this link to reset your password: <a href="${resetUrl}">Password Reset</a>. If you didn't request to have you password reset, then please ignore this email.`
            };
            sgMail.send(msg);
          });
      }

      res.send({ message: "If there is an account with that email address, then an email with a reset-link has been sent." });
    });
}

function resetPassword(req, res) {
  console.log("resetPassword()");
  const email = req.body.email;
  const token = req.body.token;
  const password = req.body.password;

  User.findOne({ email })
    .then(user => {
      if ( user && user.passwordResetToken.token === token && Date.now() - user.passwordResetToken.timestamp < 1800000) {
        user.password = password;
        user.passwordResetToken = null;
        user.save((err, user) => {
          // Todo: Handle error!
          res.send({ message: "Your password has been reset. Please log in using your new password." });
        });
      } else {
        // Todo: How do I want to handle this?
        res.status(400).send();
      }
    })

}

module.exports = router;


