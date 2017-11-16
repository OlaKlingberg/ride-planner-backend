connectedLoggedInUsers = [];

const UserService = {
  addConnectedLoggedInUser: (email, socketId) => {
    connectedLoggedInUsers.push({email, socketId});
    // console.log(connectedLoggedInUsers);
  },

  getConnectedLoggedInUsers: () => {
    return connectedLoggedInUsers.sort();
  },

  isUserAlreadyLoggedInAndConnected: (email) => {
    // console.log("isUserAlreadyLoggedInAndConnected:", connectedLoggedInUsers.filter(user => user.email === email).length >= 1);
    return connectedLoggedInUsers.filter(user => user.email === email).length >= 1;
  },

  removeConnectedLoggedInUser: socketId => {
    connectedLoggedInUsers = connectedLoggedInUsers.filter(user => {
      return user.socketId !== socketId;
    });
    // console.log(connectedLoggedInUsers);
  }

};

Object.freeze(UserService);
module.exports = { UserService };
