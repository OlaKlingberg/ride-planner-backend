require('../config/config');
const { ObjectID } = require('mongodb');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.

const router = express.Router();

router.use(bodyParser.json());

router.get('/:userId', authenticate, sendPasswordResetEmail);

function sendPasswordResetEmail(req, res) {
  let userId = req.params.userId;
}

module.exports = router;