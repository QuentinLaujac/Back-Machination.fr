'use strict';

const httpService = require('./../services/http.service');
const courseOfPlayFunctionService = require('../services/courseOfPlayFunctions.service');
const { asyncForEach } = require('./../useful');

const handleMessageQueue = async (event, context, callback) => {

    if (!event && !event.Records) {
        return httpService.defaultError({ error: 'no event found' });
    }

    await asyncForEach(event.Records, async (sqsMessage) => {
        const message = removeTypes(sqsMessage.messageAttributes);
        try {
            await courseOfPlayFunctionService["EVENT_" + message.actionType](message.senderId, message.gameId, message.actionData);
        } catch (err) {
            //TODO: retourner le callback pour éviter une boucle infinie
            console.error(`for ${message.actionType}`, err);
            return httpService.defaultError({ error: 'error handle nextAction' });
        }
    });

    callback(null, {
        'body': "ok",
        'statusCode': 200
    });

    return httpService.defaultSuccess();
};

const removeTypes = (sqsMessage) => {
    return {
        senderId: sqsMessage.senderId ? sqsMessage.senderId.stringValue : "",
        gameId: sqsMessage.gameId ? sqsMessage.gameId.stringValue : "",
        actionType: sqsMessage.actionType ? sqsMessage.actionType.stringValue : "",
        actionData: sqsMessage.actionData ? JSON.parse(sqsMessage.actionData.stringValue) : "",
    };
}

module.exports = {
    handleMessageQueue
};
