const _ = require('lodash');
const Rx = require("rxjs/Rx");

riders$ = new Rx.BehaviorSubject([]);
ridersPublic$ = new Rx.BehaviorSubject([]);

riders$.subscribe((riders) => {
  ridersPublic$.next(riders.map(rider => _.pick(rider, 'fname', 'lname', 'socketId', 'lat', 'lng')));
});

const RiderService = {
  addRider: (newRider, socketId) => {
    newRider.socketId = socketId;
    let riders = riders$.value.filter(rider => rider.email !== newRider.email);
    riders.push(newRider);
    riders$.next(riders);
  },

  removeRider: socketId => {
    let riders = riders$.value.filter(rider => rider.socketId !== socketId);
    riders$.next(riders);
  },

  getRiders: () => riders$.value,

  getRidersPublic: () => ridersPublic$.value,

  getRiders$: () => riders$,

  getRidersPublic$: () => ridersPublic$


};

Object.freeze(RiderService);
module.exports = { RiderService };


