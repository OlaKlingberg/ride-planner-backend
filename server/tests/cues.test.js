// const expect = require('expect');
// const request = require('supertest');
//
// const { ObjectID } = require('mongodb');
//
// const { app } = require('./../server');
//
// const { Cuesheet } = require('./../models/cuesheet');
// const { Cue } = require('./../models/cue');
//
// const { users } = require('./seed/users.seed');
// const { cuesheets, cues, populateCuesheets, populateCues } = require('./seed/cuesheets.seed');
// // const { cues, populateCues } = require('./seed/cues.seed');
//
// const cue = {
//   _id: new ObjectID(),
//   turn: 'Straight',
//   description: "Across the plaza.",
//   distance: 3.3,
//   lat: 40.30,
//   lng: -74.31,
//   createdAt: Date(),
//   updatedAt: Date(),
// };
//
// beforeEach(populateCuesheets);
//
// describe('POST /cuesheets/cues', () => {
//   const cuesheetId = cuesheets[0]._id;
//
//   it('should create a cue and add cue._id to the end of cuesheet.cues', done => {
//     populateCues();
//     request(app)
//       .post('/cuesheets/cues')
//       .set('x-auth', users[0].tokens[0].token)
//       .send({ cuesheetId, cue })
//       .expect(200)
//       .end(err => {
//         if ( err ) {
//           done(err);
//           return;
//         }
//
//         Cuesheet.findById(cuesheetId).then(cuesheet => {
//           expect(cuesheet.cues.length).toBe(3);
//           expect(cuesheet.cues[2].toString()).toBe(cue._id.toString());
//           done();
//         }).catch(e => done(e));
//
//       })
//   });
//
//   it('should create a cue and insert cue._id at the correct place in cuesheet.cues', done => {
//     populateCues();
//     request(app)
//       .post('/cuesheets/cues')
//       .set('x-auth', users[0].tokens[0].token)
//       .send({ cuesheetId, cue, insertBeforeId: cues[1]._id })
//       .expect(200)
//       .end(err => {
//         if ( err ) {
//           done(err);
//           return;
//         }
//
//         Cuesheet.findById(cuesheetId).then(cuesheet => {
//           expect(cuesheet.cues.length).toBe(3);
//           expect(cuesheet.cues[1].toString()).toBe(cue._id.toString());
//           done();
//         }).catch(e => done(e));
//
//       })
//   });
//
//
// });
//
// describe('DELETE /cuesheets/:cuesheetId/cues/:cueId', () => {
//   beforeEach(populateCues);
//
//   const cuesheetHexId = cuesheets[0]._id.toHexString();
//   const cueHexId = cues[0]._id.toHexString();
//
//   it('should delete a cue and delete the reference from the cuesheet', done => {
//     request(app)
//       .delete(`/cuesheets/${cuesheetHexId}/cues/${cueHexId}`)
//       .set('x-auth', users[0].tokens[0].token)
//       .expect(200)
//       .expect(res => {
//         expect(res.body.cue._id).toBe(cueHexId);
//       })
//       .end((err, res) => {
//         if ( err ) {
//           done(err);
//           return;
//         }
//
//         Cuesheet.findById(cuesheetHexId).then(cuesheet => {
//           // console.log("cuesheet, from which one cue should have been deleted:", cuesheet);
//           expect(cuesheet.cues.length).toBe(1);
//           expect(cuesheet.cues[0].toHexString()).toNotBe(cueHexId);
//
//           // Todo: Is this nesting a good idea, or is there a better way?
//           Cue.findById(cueHexId).then(cue => {
//             expect(cue).toNotExist();
//             done();
//           });
//         }).catch(e => done(e));
//
//
//       })
//   })
//
// });
//
//
