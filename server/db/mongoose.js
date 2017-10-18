let mongoose = require('mongoose');

mongoose.Promise = global.Promise;
// console.log("This is the mongoose.js file. MONGODB_URI:", process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI);

module.exports = { mongoose };
