const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let UserSchema = new mongoose.Schema({
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
  token: {
    type: String,
    require: false
  }
});

// UserSchema.methods.toJSON = function () {   // Overrides the Mongoose toJSON function.
//   const user = this;
//   const userObject = user.toObject(); // Mongoose function that strips off Mongoose methods and properties.
//                                       // Can't really say why it's needed here.
//   return _.pick(userObject, ['_id', 'email', 'token']);
// };

UserSchema.methods.generateAuthToken = function () {
  const user = this;
  const token = jwt.sign({ _id: user._id.toHexString() }, process.env.JWT_SECRET);

  return(token);
};

UserSchema.statics.findByCredentials = function (email, password) {
  const User = this;

  return User.findOne({ email }).then((user) => {
    if ( !user ) {
      return Promise.reject();
    }

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if ( res ) {
          resolve(user);
        } else {
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
