require('../config/config');

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

// Route handlers
function createRide(req, res) {
  // res.status(200).send();

  // console.log("req:", req);
  console.log("req.body:", req.body);

  const body = _.pick(req.body, ['name', 'description', '_creator']);

  console.log(body);

  const ride = new Ride(body);

  console.log(ride);

  ride.save()
    .then(() => {
    res.send(ride)
    })
    .catch(e => {
      res.status(400).send(e);
    })
}

module.exports = router;


