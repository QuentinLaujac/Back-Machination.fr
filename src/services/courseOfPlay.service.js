'use strict';

const gameDAO = require('./../dao/game.dao');
const sqsConnector = require('./../connector/sqs.connector');


class courseOfPlayService {

    handleGameAction = (gameAction, connectionId) => {
        return new Promise(async (resolve, reject) => {

            if (gameAction === undefined) {
                return reject('gameAction is undefined');
            }

            //Fetch the sender player
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

            try {
                await sqsConnector.push(senderPlayer, gameAction.name, gameAction.data);
            } catch (err) {
                return reject(err);
            }

            resolve();
        });
    }


}

const COURSE_OF_PLAY_SERVICE = new courseOfPlayService();
module.exports = COURSE_OF_PLAY_SERVICE;
