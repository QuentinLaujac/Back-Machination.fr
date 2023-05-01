'use strict';

const dynamodbConnector = require('./../connector/dynamodb.connector');
const ShortUniqueId = require('short-unique-id').default;

const tableEnum = require('./../enums/table.enum');

const CONSTANTS = require('./../constants');




class gameDAO {
    constructor() {
        this.uid = new ShortUniqueId();
    }

    createGame = (game, creator) => {
        return new Promise(async (resolve, reject) => {
            const gameId = creator.username + "" + this.uid.randomUUID(8);
            try {
                const gameToCreate = { ...game, partKey: gameId, sortId: tableEnum.SORT_ID_GAME, gameId: gameId };
                await dynamodbConnector.putItem(gameToCreate);
                resolve(gameToCreate);
            } catch (err) {
                reject(err);
            }
        })
    }

    updateGame = (game) => {
        return new Promise(async (resolve, reject) => {
            try {
                const gameToUpdate = { ...game, partKey: game.gameId, sortId: tableEnum.SORT_ID_GAME };
                await dynamodbConnector.putItem(gameToUpdate);
                resolve(gameToUpdate);
            } catch (err) {
                reject(err);
            }
        })
    }

    createPlayer = (player) => {
        return new Promise(async (resolve, reject) => {
            try {
                const playerToCreate = { ...player, partKey: player.gameId, sortId: tableEnum.SORT_ID_GAME_INFO_PLAYER + player.userId };
                await dynamodbConnector.putItem(playerToCreate);
                resolve(playerToCreate);
            } catch (err) {
                reject(err);
            }
        })
    }

    updatePlayer = (player) => {
        return new Promise(async (resolve, reject) => {
            try {
                const playerToUpdate = { ...player, partKey: player.gameId, sortId: player.sortId };
                await dynamodbConnector.putItem(playerToUpdate);
                resolve(playerToUpdate);
            } catch (err) {
                reject(err);
            }
        })
    }

    createRolePlayer = (role) => {
        return new Promise(async (resolve, reject) => {
            try {
                const rolePlayerToCreate = { ...role, partKey: role.gameId, sortId: `${tableEnum.SORT_ID_GAME_ROUND}${role.round}_PLAYER_ROLE_${role.roleName}` };
                await dynamodbConnector.putItem(rolePlayerToCreate);
                resolve(rolePlayerToCreate);
            } catch (err) {
                reject(err);
            }
        })
    }

    updateRolePlayer = (role) => {
        return new Promise(async (resolve, reject) => {
            try {
                const rolePlayerToUpdate = { ...role, partKey: role.gameId, sortId: role.sortId };
                await dynamodbConnector.putItem(rolePlayerToUpdate);
                resolve(rolePlayerToUpdate);
            } catch (err) {
                reject(err);
            }
        })
    }

    createRoundCrimeElement = (roundCrimeElement) => {
        return new Promise(async (resolve, reject) => {
            try {
                const roundCrimeToCreate = { ...roundCrimeElement, partKey: roundCrimeElement.gameId, sortId: `${tableEnum.SORT_ID_GAME_ROUND}${roundCrimeElement.round}_CRIME_ELEMENT` };
                await dynamodbConnector.putItem(roundCrimeToCreate);
                resolve(roundCrimeToCreate);
            } catch (err) {
                reject(err);
            }
        })
    }

    getRoundCrimeElement = (gameId, round) => {
        return new Promise(async (resolve, reject) => {
            try {
                const roundCrimeElement = await dynamodbConnector.getItems("partKey", gameId, "sortId", `${tableEnum.SORT_ID_GAME_ROUND}${round}_CRIME_ELEMENT`);
                resolve(roundCrimeElement);
            } catch (err) {
                reject(err);
            }
        })
    }


    createWitnessQuestion = (question) => {
        return new Promise(async (resolve, reject) => {
            const questionId = Date.now();
            try {
                const witnessQuestion = { ...question, questionId: questionId, partKey: question.gameId, sortId: `${tableEnum.SORT_ID_GAME_ROUND}${question.round}_WITNESS_QUESTION_${questionId}` };
                await dynamodbConnector.putItem(witnessQuestion);
                resolve(witnessQuestion);
            } catch (err) {
                reject(err);
            }
        })
    }

    deleteWitnessQuestion = (question) => {
        return new Promise(async (resolve, reject) => {
            try {
                const witnessQuestion = { ...question, partKey: question.gameId, sortId: `${tableEnum.SORT_ID_GAME_ROUND}${question.round}_WITNESS_QUESTION_${question.questionId}` };
                await dynamodbConnector.deleteItem(witnessQuestion);
                resolve();
            } catch (err) {
                reject(err);
            }
        })
    }


    deletePlayer = async (player) => {
        return new Promise(async (resolve, reject) => {
            try {
                await dynamodbConnector.deleteItem({ partKey: player.partKey, sortId: player.sortId });
                resolve();
            } catch (err) {
                reject(err);
            }
        })
    }

    putDataGame = async (dataGame, game) => {
        return new Promise(async (resolve, reject) => {
            try {
                dataGame.map(async item => await dynamodbConnector.putItem({ ...item, partKey: game.partKey, sortId: tableEnum.SORT_ID_GAME + "_" + item.sortId }));
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    getPlayerByConnectionId = async (connectionId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const player = await dynamodbConnector.getItems("connectionId", connectionId, "sortId", tableEnum.SORT_ID_GAME, CONSTANTS.DYNAMODB_SORT_CONNECTION_ID_TYPE_GSI);
                resolve(player[0]);
            } catch (err) {
                reject(err);
            }
        });
    }

    getPlayerByUserIdAndGameId = async (userId, gameId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const player = await dynamodbConnector.getItems("partKey", gameId, "sortId", tableEnum.SORT_ID_GAME_INFO_PLAYER + userId);
                resolve(player[0]);
            } catch (err) {
                reject(err);
            }
        });
    }

    getPlayersByGameId = async (gameId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const players = await dynamodbConnector.getItems("partKey", gameId, "sortId", tableEnum.SORT_ID_GAME_INFO_PLAYER);
                resolve(players);
            } catch (err) {
                reject(err);
            }
        });
    }

    getGameById = async (gameId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const game = await dynamodbConnector.getItems("partKey", gameId, "sortId", tableEnum.SORT_ID_GAME);
                resolve(game);
            } catch (err) {
                reject(err);
            }
        });
    }

}



const GAME_DAO = new gameDAO();
module.exports = GAME_DAO;
