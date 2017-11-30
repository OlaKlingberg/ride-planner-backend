require('../config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { authenticate } = require("../middleware/authenticate");

const https = require('https');

const router = express.Router();

router.use(bodyParser.json());

// Routes
router.get('/legs/:lat1/:lng1/:lat2/:lng2', authenticate, getLegs);
router.get('/place/:lat/:lng', authenticate, getPlace);

// Route handlers
function getLegs(req, res) {
  const lat1 = req.params.lat1;
  const lng1 = req.params.lng1;
  const lat2 = req.params.lat2;
  const lng2 = req.params.lng2;

  https.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${lat1},${lng1}&destination=${lat2},${lng2}&mode=bicycling&key=${process.env.GOOGLE_MAPS_KEY}`, (googleRes) => {
    const statusCode = googleRes.statusCode;
    const contentType = googleRes.headers['content-type'];

    let error;
    if ( statusCode !== 200 ) {
      error = new Error('Request Failed.\n' +
        `Status Code: ${statusCode}`);
    } else if ( !/^application\/json/.test(contentType) ) {
      error = new Error('Invalid content-type.\n' +
        `Expected application/json but received ${contentType}`);
    }
    if ( error ) {
      console.log(error.message);
      return;
    }

    googleRes.setEncoding('utf8');
    let rawData = '';
    googleRes.on('data', (chunk) => rawData += chunk);
    googleRes.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        res.send({data: parsedData})
      } catch ( e ) {
        console.log(e.message);
      }
    });
  }).on('error', (e) => {
    console.log(`Got error: ${e.message}`);
  });
}

function getPlace(req, res) {
  const lat = req.params.lat;
  const lng = req.params.lng;

  https.get(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=400&key=${process.env.GOOGLE_MAPS_KEY}`, (googleRes) => {
    const statusCode = googleRes.statusCode;
    const contentType = googleRes.headers['content-type'];

    let error;
    if ( statusCode !== 200 ) {
      error = new Error('Request Failed.\n' +
        `Status Code: ${statusCode}`);
    } else if ( !/^application\/json/.test(contentType) ) {
      error = new Error('Invalid content-type.\n' +
        `Expected application/json but received ${contentType}`);
    }
    if ( error ) {
      console.log(error.message);
      return;
    }

    googleRes.setEncoding('utf8');
    let rawData = '';
    googleRes.on('data', (chunk) => rawData += chunk);
    googleRes.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        res.send({data: parsedData})
      } catch ( e ) {
        console.log(e.message);
      }
    });
  }).on('error', (e) => {
    console.log(`Got error: ${e.message}`);
  });
}


module.exports = router;


