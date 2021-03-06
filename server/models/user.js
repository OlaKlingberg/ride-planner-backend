const faker = require('faker');
const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let UserSchema = new mongoose.Schema({
    admin: {
      type: Boolean,
      required: false
    },
    dummy: {
      type: Boolean,
      required: false
    },
    dummyCreator: {
      type: String,
      required: false
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
    emergencyName: {
      type: String,
      required: false,
      trim: true
    },
    emergencyPhone: {
      type: String,
      required: false,
      trim: true
    },
    fauxSocketId: {
      type: String,
      required: false
    },
    fname: {
      type: String,
      required: true,
      trim: true,
    },
    leader: {
      type: Boolean,
      require: false
    },
    lname: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    phone: {
      type: String,
      required: false,
      trim: true,
    },
    tokens: [{
      access: {
        type: String,
        required: true
      },
      token: {
        type: String,
        required: true
      }
    }],
    passwordResetToken: {
      token: {
        type: String,
        required: false
      },
      timestamp: {
        type: String,
        required: false
      }
    },
  },
  {
    timestamps: true
  }
  )
;

UserSchema.methods.generateAuthToken = function () {
  const user = this;
  const access = 'auth';
  const token = jwt.sign({ _id: user._id.toHexString() }, process.env.JWT_SECRET);

  user.tokens = [{ access, token }]; // Todo: Is this okay, or will the copying by reference cause any problem?

  return user.save()
    .then(() => {
      return token;
    });
};

UserSchema.methods.generatePasswordResetToken = function () {
  let user = this;
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  console.log("timestamp:", timestamp);

  user.passwordResetToken = { token, timestamp };
  console.log("user.passwordResetToken:", user.passwordResetToken);

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

// Overrides the Mongoose toJSON function, which seems to be applied behind the scenes when the response with the user
// is sent in users.controller.js. Only the members specified here are included on the user object sent in the
// response.
UserSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  return _.omit(userObject, ['password', 'tokens', '__v']);
};

UserSchema.statics.addDummyMembers = function (creatorEmail) {
  const User = this;
  let users = [];

  for ( let i = 0; i < 20; i++ ) {
    const fname = faker.name.firstName();
    const lname = faker.name.lastName();
    const user = new User({
      dummyCreator: creatorEmail,
      dummy: true,
      fname,
      lname,
      phone: faker.phone.phoneNumberFormat(),
      email: `${fname.toLowerCase()}.${lname.toLowerCase()}@example.com`,
      password: 'dummy-hemligt',
      emergencyName: faker.name.firstName(),
      emergencyPhone: faker.phone.phoneNumberFormat(),
      leader: (Math.random() > .92)
    });

    users.push(user);
  }

  return User.create(users);
};

UserSchema.statics.findByCredentials = function (email, password) {
  const User = this;

  return User.findOne({ email }).then(user => {
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

UserSchema.statics.findByToken = function (token) {
  console.log("findByToken");
  const User = this;
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch ( e ) {
    return Promise.reject();
  }

  // Todo: Figure this out: I find it curious that this works, since there is no user object in the db such that
  // user.tokens.access = 'auth'; there are only user objects such that user.tokens[x].access = 'auth'.
  return User.findOne({
    '_id': decoded._id,
    'tokens.access': 'auth',
    'tokens.token': token
  });
};


UserSchema.statics.getDemoUsers = function () {
  const User = this;

  return User.find({
    demo: true
  })
};

UserSchema.statics.getDummyUsers = function (skip, take) {
  const User = this;

  return User.find({
    dummy: true
  })
    .skip(skip)
    .limit(take);
};

UserSchema.pre('save', function (next) {
  const user = this;

  if ( user.isModified('password') ) {
    bcrypt.genSalt(1, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

UserSchema.statics.removeDummyMembers = function () {
  const User = this;

  return User.remove({ dummy: true }).exec();
};


const User = mongoose.model('User', UserSchema);

module.exports = { User };
