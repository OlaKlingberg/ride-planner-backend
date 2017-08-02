require('../config/config');
const { ObjectID } = require('mongodb');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
// const { User } = require('../models/user');
const { Ride } = require('../models/ride');

const router = express.Router();

// const { RiderService } = require('../utils/rider-service');

// Use JWT auth to secure the api
// const authenticateWithJwt = expressJwt({ secret: process.env.JWT_SECRET });

router.use(bodyParser.json());

// Routes
router.post('/', authenticate, createRide);
router.delete('/:_id', authenticate, deleteRide);

// Route handlers
function createRide(req, res) {
  const body = _.pick(req.body, ['name', 'description', '_creator']);
  const ride = new Ride(body);

  ride.save()
    .then(() => {
      res.send(ride)
    })
    .catch(e => {
      res.status(400).send(e);
    })
}

function deleteRide(req, res) {
  const name = req.params._id;

  Ride.findOneAndRemove({ name })
    .then(ride => {
      if ( !ride ) res.status(404).send();
      return res.send({ ride });
    }).catch(err => {
    res.status(400).send(err);
  })

}

module.exports = router;


