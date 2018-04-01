require('./config/config');
const port = process.env.PORT;

const _ = require('lodash');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require("cors");

const { mongoose } = require('./db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const SocketServer = require('./socket-server').SocketServer;

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const socketServer = new SocketServer;

socketServer.startSocketServer(io);

app.use(cors());

// Api routes
app.use('/users', require('./controllers/users.controller'));
app.use('/cuesheets', require('./controllers/cuesheets.controller'));
app.use('/rides', require('./controllers/rides.controller'));
app.use('/geo', require('./controllers/geo.controller'));
// app.use('/email', require('./controllers/email.controller'));

app.get('/', (req, res) => {
  res.send("RidePlanner API is up and running!");
});


server.listen(port, () => {
  console.log(`Started on port ${port}`);
  console.log('process.env.ENV:', process.env.ENV);
});

module.exports = { app };


