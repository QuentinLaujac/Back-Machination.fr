'use strict';

const tokenService = require('./../services/token.service');
const { gameService } = require('./../services/game.service');
const httpService = require('./../services/http.service');

/**
 * Create a game and returns all relevant information to its creation
 * @param {} event 
 * @param {*} context 
 */
const createGame = async (event, context) => {

    const data = JSON.parse(event.body);

    let cognitoUser = {};
    try {
        cognitoUser = await tokenService.extractUser(data.user.tokenId);
    } catch (err) {
        console.error(err);
        return httpService.defaultError({ error: 'unable to fetch the user from the token' }, 401);
    }

    let game = {};
    try {
        game = await gameService.createGame(cognitoUser.userId);
    } catch (err) {
        console.error(err);
        return httpService.defaultError({ error: 'unable to create a game' });
    }

    return httpService.defaultSuccess(game);
};

module.exports = {
    createGame
};
