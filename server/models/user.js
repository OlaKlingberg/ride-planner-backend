const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let UserSchema = new mongoose.Schema({
  fname: {
    type: String,
    required: true,
    trim: true,
  },
  lname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 4,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password: {
    type: String,
    require: true,
    minlength: 6
  },
  tokens: [{
    access: {
      type: String,
      require: true
    },
    token: {
      type: String,
      require: true
    }
  }]
});

// Overrides the Mongoose toJSON function, which seems to be applied behind the scenes when the response with the user is sent in users.controller.js. Only the members specified here are included on the user object sent in the response.
UserSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  return _.pick(user, ['_id', 'fname', 'lname', 'email']);
};

UserSchema.methods.generateAuthToken = function () {
  const user = this;
  const access = 'auth';
  const token = jwt.sign({ _id: user._id.toHexString() }, process.env.JWT_SECRET);

  user.tokens.push({ access, token });

  return user.save()
    .then(() => {
      return token;
    });
};

UserSchema.methods.removeToken = function (token) {
  const user = this;

  return user.update({
    $pull: {
      tokens: { token }
    }
  });
};

UserSchema.statics.findByToken = function (token) {
    const User = this;
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch ( e ) {
      return Promise.reject();
    }

    return User.findOne({
      '_id': decoded._id,
      'tokens.token': token,
      'tokens.access': 'auth'
    })
};

UserSchema.statics.findByCredentials = function (email, password) {
  const User = this;

  console.log(`user.js. About to look for ${email} with password ${password}`);

  return User.findOne({ email }).then((user) => {
    console.log(`Found in the database: ${user}`);
    if ( !user ) {
      console.log("About to reject.");
      return Promise.reject();
    }
    console.log("About to return new Promise.");
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        console.log("Just compared passwords.");
        if ( res ) {
          console.log("Password was correct. About to resolve with user.");
          resolve(user);
        } else {
          console.log("Password was incorrect. About to reject.");
          reject();
        }
      });
    });
  })
};

UserSchema.pre('save', function (next) {
  const user = this;

  if ( user.isModified('password') ) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});


const User = mongoose.model('User', UserSchema);

module.exports = { User };
