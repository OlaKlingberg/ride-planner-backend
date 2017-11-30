connectedLoggedInUsers = [];

const UserService = {
  addConnectedLoggedInUser: (email, socketId) => {
    connectedLoggedInUsers.push({email, socketId});
  },

  getConnectedLoggedInUsers: () => {
    return connectedLoggedInUsers.sort();
  },

  isUserAlreadyLoggedInAndConnected: (email) => {
    return connectedLoggedInUsers.filter(user => user.email === email).length >= 1;
  },

  removeConnectedLoggedInUser: socketId => {
    connectedLoggedInUsers = connectedLoggedInUsers.filter(user => {
      return user.socketId !== socketId;
    });
  }

};

Object.freeze(UserService);
module.exports = { UserService };
