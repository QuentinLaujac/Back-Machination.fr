'use strict';

const {
    authWebsocket,
    onSignup,
    refreshToken,
    signup
} = require('./src/controllers/auth.controller');

const {
    populateGameEngine
} = require('./src/controllers/admin.controller');

const {
    createGame
} = require('./src/controllers/game.controller');

const {
    gameSocketHandler
} = require('./src/controllers/websocket.game.controller');

const {
    defaultSocketHandler,
    handleSocketConnect,
    handleSocketDisconnect
} = require('./src/controllers/websocket.default.controller');

const {
    handleMessageQueue
} = require('./src/controllers/queue.controller');

module.exports.populateGameEngine = populateGameEngine;
module.exports.onSignup = onSignup;
module.exports.signup = signup;
module.exports.authWebsocket = authWebsocket;
module.exports.defaultSocketHandler = defaultSocketHandler;
module.exports.gameSocketHandler = gameSocketHandler;
module.exports.createGame = createGame;
module.exports.handleSocketConnect = handleSocketConnect;
module.exports.handleSocketDisconnect = handleSocketDisconnect;
module.exports.refreshToken = refreshToken;
module.exports.handleMessageQueue = handleMessageQueue;
