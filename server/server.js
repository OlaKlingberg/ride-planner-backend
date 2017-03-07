require('./config/config');
const port = process.env.PORT;

const _ = require('lodash');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const { mongoose } = require('./db/mongoose'); // So that mongoose.Promise is set to global.Promise.
const apiRoutes = require('./api-routes');
const SocketServer = require('./socket-server');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const socketServer = new SocketServer;

socketServer.startSocketServer(io);

app.use('/', apiRoutes);

server.listen(port, () => {
  console.log(`Started on port ${port}`);
  console.log('process.env.ENV');
  console.log(process.env.ENV);
});

module.exports = { app };


