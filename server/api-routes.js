require('./config/config');

const _ = require('lodash');
const express = require('express');
const { ObjectID } = require('mongodb');
const bodyParser = require('body-parser');

const { mongoose } = require('./db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const { Todo } = require('./models/todo');
const { User } = require('./models/user');
const { authenticate } = require('./middleware/authenticate');

const router = express.Router();

router.use(bodyParser.json());

// router.use(function(req, res, next) {
//   // These headers are only needed if the angular app and the api run on different servers.
//   // In they are, and these headers are omitted, there will be a CORS error.
//   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
//   res.setHeader('Access-Control-Allow-Credentials', true);
//   res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
//   next();
// });


router.post('/todos', authenticate, (req, res) => {
  const todo = new Todo({
    text: req.body.text,
    _creator: req.user._id
  });

  todo.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });

});

router.get('/todos', authenticate, (req, res) => {
  Todo.find({
    _creator: req.user._id
  }).then((todos) => {
    res.send({ todos });
  }, (e) => {
    res.status(400).send(e);
  });
});

router.get('/todos/:id', authenticate, (req, res) => {
  const id = req.params.id;

  if ( !ObjectID.isValid(id) ) {
    return res.status(404).send();
  }

  Todo.findOne({
    _id: id,
    _creator: req.user._id
  }).then((todo) => {
    if ( !todo ) {
      return res.status(404).send();
    }
    res.send({ todo });
  }).catch((e) => res.status(400).send());
});

router.delete('/todos/:id', authenticate, (req, res) => {
  const id = req.params.id;

  if ( !ObjectID.isValid(id) ) {
    return res.status(404).send();
  }

  Todo.findOneAndRemove({
    _id: id,
    _creator: req.user._id
  }).then((todo) => {
    if ( !todo ) {
      return res.status(404).send();
    }
    res.send({ todo });
  }).catch((e) => {
    res.status(400).send();
  });

});

router.patch('/todos/:id', authenticate, (req, res) => {
  const id = req.params.id;
  const body = _.pick(req.body, ['text', 'completed']);

  if ( !ObjectID.isValid(id) ) {
    return res.status(404).send();
  }

  if ( _.isBoolean(body.completed) && body.completed ) {
    body.completedAt = new Date().getTime();
  } else {
    body.completed = false;
    body.completedAt = null;
  }

  Todo.findOneAndUpdate({
    _id: id,
    _creator: req.user._id
  }, { $set: body }, { new: true }).then((todo) => {
    if ( !todo ) {
      return res.status(404).send();
    }

    res.send({ todo });
  }).catch((e) => {
    res.status(400).send();
  });

});

// POST /users
router.post('/users', (req, res) => {
  const body = _.pick(req.body, ['email', 'password']);
  const user = new User(body);

  user.save().then(() => {
    return user.generateAuthToken();
  }).then((token) => {
    res.header('x-auth', token).send(user); // x- denotes a custom header, not part of the HTTP standard.
  }).catch((e) => {
    res.status(400).send(e);
  })
});

router.get('/users/me', authenticate, (req, res) => {
  res.send(req.user);
});

router.post('/users/login', (req, res) => {
  const body = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(body.email, body.password).then((user) => {
    return user.generateAuthToken().then((token) => {
      res.header('x-auth', token).send(user);
    });
  }).catch((e) => {
    res.status(400).send();
  });
});

router.delete('/users/me/token', authenticate, (req, res) => {
  req.user.removeToken(req.token).then(() => {
    res.status(200).send();
  }, () => {
    res.status(400).send();
  });
});

module.exports = router;
