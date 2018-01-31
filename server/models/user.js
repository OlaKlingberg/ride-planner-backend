const faker = require('faker');
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
    phone: {
      type: String,
      required: false,
      trim: true,
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
    fauxSocketId: {
      type: String,
      required:
        false
    }
    ,
    password: {
      type: String,
      require:
        true,
      minlength:
        6
    }
    ,
    emergencyName: {
      type: String,
      required:
        false,
      trim:
        true
    }
    ,
    emergencyPhone: {
      type: String,
      required:
        false,
      trim:
        true
    }
    ,
    admin: {
      type: Boolean,
      require:
        false
    }
    ,
    dummy: {
      type: Boolean,
      require:
        false
    }
    ,
    dummyCreator: {
      type: String,
      require:
        false
    }
    ,
    leader: {
      type: Boolean,
      require:
        false
    }
    ,

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
  },
  {
    timestamps: true
  }
  )
;

// Overrides the Mongoose toJSON function, which seems to be applied behind the scenes when the response with the user
// is sent in users.controller.js. Only the members specified here are included on the user object sent in the
// response.
UserSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  return _.omit(userObject, ['password', 'tokens', '__v']);
};

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

UserSchema.methods.removeToken = function (token) {
  const user = this;

  return user.update({
    $pull: {
      tokens: { token }
    }
  });
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

  console.log("About to return User.create(users)");
  return User.create(users);
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
