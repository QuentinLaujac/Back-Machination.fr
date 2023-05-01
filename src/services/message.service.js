'use strict';

const gameDAO = require('./../dao/game.dao');
const messageDAO = require('./../dao/message.dao');
const tableEnum = require('./../enums/table.enum');
const apigatewayConnector = require('./../connector/apigateway.connector');

const sendMessageBySocket = (receiverId, message, eventType) => {
    return new Promise(async (resolve, reject) => {
        try {
            await apigatewayConnector.generateSocketMessage(receiverId, JSON.stringify({
                action: eventType,
                value: message
            }));
        } catch (err) {
            reject(`Unable to deliver message to ${player.connectionId}`)
        }
        resolve();
    });
}

class messageService {

    sendEventMessage = (message, gameId, messageType, author) => {
        return new Promise(async (resolve, reject) => {

            // fetch game information
            let gameInfos = {};
            try {
                gameInfos = await gameDAO.getGameById(gameId)
            } catch (err) {
                return reject(err);
            }
            //

            //save the message in data base
            const sender = author ? author : "SYSTEM";
            let messageSaved = {};
            try {
                messageSaved = await messageDAO.createMessage({ ...message, sender: sender, gameId: gameId })
            } catch (err) {
                return reject(err);
            }
            //

            //Send the message to the receivers, sender include
            const allPlayer = gameInfos.filter(elmt => elmt.sortId.includes(tableEnum.SORT_ID_GAME_INFO_PLAYER));

            if (messageSaved.receiver === 'ALL') {
                let promises = [];
                allPlayer.map((player) => {
                    promises.push(sendMessageBySocket(player.connectionId, messageSaved, messageType));
                });
                try {
                    await Promise.all(promises);
                } catch (err) {
                    reject(`Unable to deliver message to ${player.connectionId}`)
                }
            } else {
                const receiverPlayer = allPlayer.filter(player => player.connectionId === messageSaved.receiver || player.connectionId === senderPlayer.connectionId);
                try {
                    await sendMessageBySocket(receiverPlayer.connectionId, messageSaved, messageType);
                } catch (err) {
                    return reject(`Unable to deliver message to ${receiverPlayer.connectionId}`)
                }
            }
            //

            resolve(messageSaved);
        })
    }

    sendMessage = (message, connectionId, messageType) => {
        return new Promise(async (resolve, reject) => {

            //Fetch the player
            let senderPlayer = {};
            try {
                senderPlayer = await gameDAO.getPlayerByConnectionId(connectionId);
            } catch (err) {
                return reject(err);
            }
            if (senderPlayer === undefined) {
                return reject('the player is not present in any game');
            }
            //

            // fetch game information
            let gameInfos = {};
            try {
                gameInfos = await gameDAO.getGameById(senderPlayer.gameId)
            } catch (err) {
                return reject(err);
            }
            //

            //save the message in data base
            let messageSaved = {};
            try {
                messageSaved = await messageDAO.createMessage({ ...message, sender: senderPlayer.userId, gameId: senderPlayer.gameId, senderUsername: senderPlayer.username })
            } catch (err) {
                return reject(err);
            }
            //

            //Send the message to the receivers, sender include
            const allPlayer = gameInfos.filter(elmt => elmt.sortId.includes(tableEnum.SORT_ID_GAME_INFO_PLAYER));

            if (messageSaved.receiver === 'ALL') {
                let promises = [];
                allPlayer.map((player) => {
                    promises.push(sendMessageBySocket(player.connectionId, messageSaved, messageType));
                });
                try {
                    await Promise.all(promises);
                } catch (err) {
                    reject(`Unable to deliver message to ${player.connectionId}`)
                }
            } else {
                const receiverPlayer = allPlayer.filter(player => player.connectionId === messageSaved.receiver || player.connectionId === senderPlayer.connectionId);
                try {
                    await sendMessageBySocket(receiverPlayer.connectionId, messageSaved, messageType);
                } catch (err) {
                    return reject(`Unable to deliver message to ${receiverPlayer.connectionId}`)
                }
            }
            //

            resolve(messageSaved);
        })
    }

}

const MESSAGE_SERVICE = new messageService();
module.exports = MESSAGE_SERVICE;
