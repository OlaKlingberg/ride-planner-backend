require('../config/config');
const { ObjectID } = require('mongodb');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { authenticate } = require("../middleware/authenticate");

const { mongoose } = require('../db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { Cuesheet } = require('../models/cuesheet');
const { Cue } = require('../models/cue');
const { User } = require('../models/user');

const router = express.Router();

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
  Cuesheet.find({})
    .populate('_creator', ['fname', 'lname'])
    .exec((err, cuesheets) => {
      if ( err ) res.status(400).send(err);
      res.send({ cuesheets });
    })
}

function createCuesheet(req, res) {
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
  const user = req.user;
  const cuesheetId = req.params._id;
  const body = _.pick(req.body, ['name', 'description']);

  if ( !ObjectID.isValid(cuesheetId) ) return res.status(404).send();

  Cuesheet.findOne({ _id: cuesheetId })
    .then(cuesheet => {
      let userIsSuperAdmin = user.email === process.env.SUPER_ADMIN;

      if ( userIsSuperAdmin || user.admin || user.leader || user._id.toString() === cuesheet._creator.toString() ) {
        cuesheet.update({ $set: body }, { new: true })
          .then(cuesheet => {
            if ( !cuesheet ) return res.status(404).send();
            res.send({ cuesheet })
          })
          .catch(err => res.status(400).send(err));
      } else {
        res.status(401).send();
      }

    });
}

function deleteCuesheet(req, res) {
  const user = req.user;
  const cuesheetId = req.params._id;

  if ( !ObjectID.isValid(cuesheetId) ) res.status(404).send();

  Cuesheet.findOne({ _id: cuesheetId })
    .then(cuesheet => {
      let userIsSuperAdmin = user.email === process.env.SUPER_ADMIN;

      if ( userIsSuperAdmin || user.admin || user.leader || user._id.toString() === cuesheet._creator.toString() ) {
        cuesheet.remove()
          .then(cuesheet => {
            if ( !cuesheet ) return res.status(404).send();

            Cue.remove({ _id: { $in: cuesheet.cues } }, () => {
              return res.send({ cuesheet });
            });
          })
          .catch(err => res.status(400).send(err));
      } else {
        res.status(401).send();
      }
    });
}

function createCue(req, res) {
  const body = _.pick(req.body, ['cuesheetId', 'cue', 'insertBeforeId']);
  const cuesheetId = body.cuesheetId;
  const cue = body.cue;
  const insertBeforeId = body.insertBeforeId;
  const user = req.user;
  cue._creator = user._id;
  console.log("cue:", cue);

  if ( !ObjectID.isValid(cuesheetId) ) return res.status(400).send();

  Cuesheet.findOne({ _id: cuesheetId })
    .then(cuesheet => {
      let userIsSuperAdmin = user.email === process.env.SUPER_ADMIN;

      if ( userIsSuperAdmin || user.admin || user.leader || user._id.toString() === cuesheet._creator.toString() ) {
        Cue.create(cue)
          .then(cue => {
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
          .catch(err => res.status(400).send(err));
      } else {
        res.status(403).send();
      }
    });
}

function updateCue(req, res) {
  const cueId = req.params._id;
  const cue = _.pick(req.body, ['distance', 'turn', 'description']);
  const user = req.user;

  if ( !ObjectID.isValid(cueId) ) return res.status(404).send();

  const userIsSuperAdmin = user.email === process.env.SUPER_ADMIN;

  if ( userIsSuperAdmin || user.admin || user.leader || !cue._creator || user._id.toString() === cue._creator.toString() ) {
    Cue.findOneAndUpdate({ _id: cueId }, { $set: cue }, { new: true }).then(cue => {
      if ( !cue ) return res.status(404).send();

      return res.send(cue);
    }).catch(err => res.status(400).send(err));
  } else {
    res.status(403).send();
  }
}

// Todo: Is there any way of getting rid of this multi-level nesting?
function deleteCue(req, res) {
  const cuesheetId = req.params.cuesheetId;
  const cueId = req.params.cueId;
  const user = req.user;

  if ( !ObjectID.isValid(cuesheetId) || !ObjectID.isValid(cueId) ) return res.status(404).send();

  Cuesheet.findById(cuesheetId, (err, cuesheet) => {
    if ( !cuesheet ) return res.status(404).send();

    const userIsSuperAdmin = user.email === process.env.SUPER_ADMIN;
    const userIsCuesheetCreator = user._id.toString() === cuesheet._creator.toString();

    if ( userIsSuperAdmin || user.admin || user.leader || userIsCuesheetCreator ) {
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
          }).catch(err => {
          res.status(400).send(err);
        });
      });
    } else {
      res.status(403).send();
    }
  });
}

module.exports = router;
