'use strict';

const dynamodbConnector = require('./../connector/dynamodb.connector');
const courseOfPlayData = require('./../data/courseOfPlay.json');
const evidencesData = require('./../data/evidences.json');
const roles = require('./../data/roles.json');
const rules = require('./../data/rules.json');

const tableEnum = require('./../enums/table.enum');


class gameEngineDAO {
    constructor() {
    }

    populate = () => {
        return new Promise(async (resolve, reject) => {
            try {
                courseOfPlayData.map(async item => await dynamodbConnector.putItem(item));
                evidencesData.map(async item => await dynamodbConnector.putItem(item));
                roles.map(async item => await dynamodbConnector.putItem(item));
                rules.map(async item => await dynamodbConnector.putItem(item));
                resolve();
            } catch (err) {
                reject(err);
            }
        })
    }

    getDataGame = () => {
        return new Promise(async (resolve, reject) => {
            try {
                const dataGame = await dynamodbConnector.getItems(tableEnum.COLUMN_PART_KEY, tableEnum.PART_KEY_GAME_ENGINE, tableEnum.COLUMN_SORT_KEY, tableEnum.SORT_ID_DATA_GAME);
                resolve(dataGame);
            } catch (err) {
                reject(err);
            }
        })
    }

    getEvidences = () => {
        return new Promise(async (resolve, reject) => {
            try {
                const evidences = await dynamodbConnector.getItems(tableEnum.COLUMN_PART_KEY, tableEnum.PART_KEY_GAME_ENGINE, tableEnum.COLUMN_SORT_KEY, tableEnum.SORT_ID_DATA_EVIDENCE);
                resolve(evidences);
            } catch (err) {
                reject(err);
            }
        })
    }

}



const GAME_ENGINE_DAO = new gameEngineDAO();
module.exports = GAME_ENGINE_DAO;
