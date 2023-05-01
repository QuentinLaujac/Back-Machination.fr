'use strict';

const dynamodbConnector = require('./../connector/dynamodb.connector');
const ShortUniqueId = require('short-unique-id').default;

const tableEnum = require('./../enums/table.enum');

const CONSTANTS = require('./../constants');

class messageDAO {
    constructor() {
        this.uid = new ShortUniqueId();
    }

    createMessage = (message) => {
        return new Promise(async (resolve, reject) => {
            const timestamp = Date.now();
            const dateSortKey = message.receiver === "ALL" ? "ALL_" + timestamp : message.receiver + "_" + timestamp;
            try {
                const messageTocreate = { ...message, partKey: message.gameId, sortId: tableEnum.SORT_ID_GAME_INFO_MESSAGE + dateSortKey, messageDate: timestamp };
                await dynamodbConnector.putItem(messageTocreate);
                resolve(messageTocreate);
            } catch (err) {
                reject(err);
            }
        })
    }
}



const MESSAGE_DAO = new messageDAO();
module.exports = MESSAGE_DAO;
