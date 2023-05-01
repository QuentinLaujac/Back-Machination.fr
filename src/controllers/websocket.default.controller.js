'use strict';

const apigatewayConnector = require('../connector/apigateway.connector');
const httpService = require('../services/http.service');
const { gameService } = require('../services/game.service');
const tokenService = require('../services/token.service');

const defaultSocketHandler = async (event, context) => {
    try {
        const data = JSON.parse(event.body);
        const action = data.action;

        const connectionId = event.requestContext.connectionId;
        switch (action) {
            case 'PING':
                const pingResponse = JSON.stringify({ action: 'PING', value: 'PONG' });
                await apigatewayConnector.generateSocketMessage(connectionId, pingResponse);
                break;
            default:
                const invalidResponse = JSON.stringify({ action: 'ERROR', error: 'Invalid request' });
                await apigatewayConnector.generateSocketMessage(connectionId, invalidResponse);
        }
        return httpService.defaultSuccess({ success: 'Default socket response.' });

    } catch (err) {
        console.error('Unable to generate default response', err);
        return httpService.defaultError({ error: 'Default socket response error.' })
    }
};

const handleSocketConnect = async (event, context) => {
    try {

        const connectionId = event.requestContext.connectionId;
        const gameId = event.queryStringParameters.gameId;
        const authorizer = event.queryStringParameters.Authorizer;

        let user = {};
        try {
            user = await tokenService.extractUser(authorizer);
        } catch (err) {
            console.error(err);
            return httpService.defaultError({ error: 'unable to fetch the user from the token' }, 401);
        }

        //TODO: pour rejoindre une partie ce sera via un event dans game socket

        let game = {};
        try {
            game = await gameService.joinGame(user.userId, gameId, connectionId);
        } catch (err) {
            console.error(err);
            return httpService.defaultError({ error: 'Unable to register socket into the game' });
        }

        return httpService.defaultSuccess({ success: 'Socket successfully registered .', data: game });

    } catch (err) {
        console.error('Unable to initialize socket connection', err);
        return httpService.defaultError({ error: 'Unable to register socket.' });
    }
};

const handleSocketDisconnect = async (event, context) => {
    try {
        const connectionId = event.requestContext.connectionId;

        //TODO: Gerer aussi dans game socket controller quand le joueur quitte proprement la partie via un event
        try {
            await gameService.userQuitGame(connectionId);
        } catch (err) {
            console.error(err);
            return httpService.defaultError({ error: 'Socket unsuccessfully terminated.' });
        }

        return httpService.defaultSuccess({ success: 'Socket successfully terminated.' });

    } catch (err) {
        console.error('Unable to terminate socket connection', err);
        httpService.defaultError({ error: 'Unable to terminate socket.' });
    }
};

module.exports = {
    defaultSocketHandler,
    handleSocketConnect,
    handleSocketDisconnect
};
