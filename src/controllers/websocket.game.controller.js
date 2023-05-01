'use strict';


const apigatewayConnector = require('../connector/apigateway.connector');
const httpService = require('../services/http.service');
const { gameService } = require('../services/game.service');
const courseOfPlayService = require('../services/courseOfPlay.service');
const messageService = require('../services/message.service');
const gameEnum = require('./../enums/game.enum');

const gameSocketHandler = async (event, context) => {
    try {
        const connectionId = event.requestContext.connectionId;

        const data = JSON.parse(event.body);

        switch (data.type) {
            case 'FETCH_DATA_GAME':
                await gameService.fetchDataGame(connectionId);
                break;
            case 'UPDATE_GAME_RULES':
                await gameService.updateGameRules(data.message.gameInfos, connectionId);
                break;
            case 'GAME_ACTION':
                await courseOfPlayService.handleGameAction(data.message.gameAction, connectionId);
                break;
            case 'MESSAGE':
                await messageService.sendMessage({ receiver: data.message.receiver, content: data.message.content }, connectionId, gameEnum.GAME_SEND_MESSAGE);
                break;
            default:
                const invalidResponse = JSON.stringify({ action: 'ERROR', error: 'Invalid request' });
                await apigatewayConnector.generateSocketMessage(connectionId, invalidResponse);
        }

        // Let the API Gateway Websocket know everything went OK.
        return httpService.defaultSuccess({ success: 'Game socket response.' });
    } catch (err) {
        // Notify API Gateway Websocket in case of error, also log it on
        // CloudWatch
        console.error('Game socket response error.', err);
        return httpService.defaultError({ error: 'Game socket response error.' });
    }
};


module.exports = {
    gameSocketHandler
};
