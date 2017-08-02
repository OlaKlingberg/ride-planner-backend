require('../config/config');
const { ObjectID } = require('mongodb');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { Cuesheet } = require('../models/cuesheet');
const { Cue } = require('../models/cue');

const router = express.Router();

// Use JWT auth to secure the api
// const authenticateWithJwt = expressJwt({ secret: process.env.JWT_SECRET });

router.use(bodyParser.json());

// Routes
router.get('/', authenticate, getAllCuesheets);
router.post('/', authenticate, createCuesheet);
router.get('/:_id', authenticate, getCuesheet);
router.patch('/:_id', authenticate, updateCuesheet);
router.delete('/:_id', authenticate, deleteCuesheet);
router.post('/cues', authenticate, createCue);
router.patch('/cues/:_id', authenticate, updateCue);
router.delete('/:cuesheetId/cues/:cueId', authenticate, deleteCue);

// Route handlers
function getAllCuesheets(req, res) {
  // Cuesheet.find({})
  //   .then(cuesheets => {
  //     res.send({ cuesheets });
  //   }, (e) => {
  //     res.status(400).send(e);
  //   });

  Cuesheet.find({})
    .populate('_creator', ['fname', 'lname'])
    .exec((err, cuesheets) => {
      if ( err ) res.status(400).send(err);
      res.send({ cuesheets });
    })
}

function createCuesheet(req, res) {

  console.log("req.body:", req.body);

  const body = _.pick(req.body, ['name', 'description', '_creator']);
  const cuesheet = new Cuesheet(body);

  cuesheet.save()
    .then(() => {
      res.send(cuesheet)
    })
    .catch(e => {
      res.status(400).send(e);
    })
}

function getCuesheet(req, res) {
  const _id = req.params._id;

  if ( !ObjectID.isValid(_id) ) {
    return res.status(404).send();
  }

  Cuesheet.findOne({ _id })
    .populate('_creator', ['fname', 'lname'])
    .populate('cues')
    .exec((err, cuesheet) => {
      if ( err || !cuesheet ) {
        res.status(404).send(err);
      } else {
        res.send({ cuesheet });
      }
    })
}

function updateCuesheet(req, res) {
  const _id = req.params._id;
  const body = _.pick(req.body, ['name', 'description']);

  if ( !ObjectID.isValid(_id) ) return res.status(400).send();

  Cuesheet.findOneAndUpdate({ _id }, { $set: body }, { new: true })
    .then(cuesheet => {
      if ( !cuesheet ) return res.status(404).send();

      res.send({ cuesheet });
    }).catch(e => {
    res.status(400).send();
  });
}

function deleteCuesheet(req, res) {
  const _id = req.params._id;

  if ( !ObjectID.isValid(_id) ) res.status(404).send();

  Cuesheet.findOneAndRemove({ _id })
    .then(cuesheet => {
      if ( !cuesheet ) res.status(404).send();

      // Delete the cues belonging to the cuesheet.
      Cue.remove({ _id: { $in: cuesheet.cues } }, () => {
        return res.send({ cuesheet });
      });

    }).catch(err => {
    res.status(400).send(err);
  });
}

function createCue(req, res) {
  const body = _.pick(req.body, ['cuesheetId', 'cue', 'insertBeforeId']);
  const cuesheetId = body.cuesheetId;
  const cue = body.cue;
  const insertBeforeId = body.insertBeforeId;

  if ( !ObjectID.isValid(cuesheetId) ) return res.status(400).send();

  Cue.create(cue)
    .then(cue => {
      Cuesheet.findById(cuesheetId)
        .then(cuesheet => {
          if ( insertBeforeId ) {
            let idx = _.findIndex(cuesheet.cues, _id => {
              return _id.toString() === insertBeforeId
            });
            cuesheet.cues.splice(idx, 0, cue._id);
          } else {
            cuesheet.cues.push(cue._id);
          }
          return cuesheet.save();
        })
        .then(() => {
          return res.send(cue);
        })
        .catch(e => console.log(e));
    });
}

function updateCue(req, res) {
  const _id = req.params._id;
  const cue = _.pick(req.body, ['distance', 'turn', 'description']);

  if ( !ObjectID.isValid(_id) ) return res.status(404).send();

  Cue.findOneAndUpdate({ _id }, { $set: cue }, { new: true }).then(cue => {
    if ( !cue ) {
      return res.status(404).send();
    }

    return res.send({ cue });
  }).catch(e => res.status(400).send());
}

// Todo: Is there any way of getting rid of this multi-level nesting?
function deleteCue(req, res) {
  const cuesheetId = req.params.cuesheetId;
  const cueId = req.params.cueId;

  if ( !ObjectID.isValid(cuesheetId) || !ObjectID.isValid(cueId) ) return res.status(404).send();

  Cuesheet.findById(cuesheetId, (err, cuesheet) => {
    if ( !cuesheet ) return res.status(404).send();
    cuesheet.cues = _.filter(cuesheet.cues, cue => {
      return cue.toString() !== cueId;
    });

    cuesheet.save((err, updatedCuesheet) => {
      if ( err ) console.log(err);

      Cue.findByIdAndRemove(cueId)
        .then(cue => {
          if ( !cue ) {
            return res.status(404).send();
          }
          res.send({ cue });
        }).catch(e => {
        res.status(400).send();
      });

    });

  });
}

module.exports = router;
