'use strict';

const userDAO = require('./../dao/user.dao');
const gameDAO = require('./../dao/game.dao');
const gameEngineDAO = require('./../dao/gameEngine.dao');
const tableEnum = require('./../enums/table.enum');
const gameEnum = require('./../enums/game.enum');
const apigatewayConnector = require('./../connector/apigateway.connector');
const courseOfPlayService = require('./courseOfPlay.service');
const messageService = require('./message.service');
const { asyncForEach, retrieveTheGame, retrievePlayers, retrievePlayerByUserId, retrieveRolePlayerByUserId, retrieveRolePlayers, retrieveWitnessQuestion } = require('../useful');

const cancelStartingGame = (players, game) => {
    return new Promise(async (resolve, reject) => {

        //We update the game
        game.step = 0;
        game.nextStep = 1;
        game.round = 0;

        try {
            await gameDAO.updateGame(game);
        } catch (err) {
            return resolve(err);
        }
        //

        // Send message to all players we cancel the start of the game
        let promisesAllPlayersReset = [];
        players.forEach((player) => {
            promisesAllPlayersReset.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.CANCEL_GAME_INIT
            })))
        });
        try {
            await Promise.all(promisesAllPlayersReset);
        } catch (err) {
            reject(err);
        }
        //

        //Update all player one after the other to said they are all ready
        try {
            await asyncForEach(players, async (player) => await courseOfPlayService.handleGameAction({ name: "NEXT" }, player.connectionId));
        } catch (err) {
            reject(err);
        }
        //

        resolve();
    })
}

class gameService {
    constructor() {
    }

    createGame = (userId) => {
        return new Promise(async (resolve, reject) => {

            // fetch all availables roles and course of play and events
            let dataGame = {};
            let user = {}
            try {
                const result = await Promise.all([userDAO.getUserById(userId), gameEngineDAO.getDataGame()])
                user = result[0];
                dataGame = result[1];
            } catch (err) {
                return reject(err);
            }

            const rolesList = dataGame.filter(elmt => elmt.sortId.includes("DataGame_Role_") && !elmt.sortId.includes("_Mandatory_"));
            const rolesAvailableUnmandatory = user.profile === tableEnum.VALUE_PREMIUM ? rolesList : dataGame.filter(elmt => elmt.sortId.includes("DataGame_Role_Free") && !elmt.sortId.includes("_Mandatory_"));
            const rolesMandatory = dataGame.filter(elmt => elmt.sortId.includes("DataGame_Role_") && elmt.sortId.includes("_Mandatory_"));
            const rules = dataGame.filter(elmt => elmt.sortId.includes("DataGame_Rules"));

            const gameToCreate = {
                numberPlayerToStart: rules[0].defaultNumberPlayerToStart,
                numberPlayerInGame: 0,
                numberMinPlayer: rules[0].numberMinPlayer,
                numberMaxPlayer: rules[0].numberMaxPlayer,
                rolesAvailable: JSON.stringify(rolesAvailableUnmandatory),
                rolesList: JSON.stringify(rolesList),
                rolesMandatory: JSON.stringify(rolesMandatory),
                rolesChoosen: JSON.stringify([rolesAvailableUnmandatory[0], rolesAvailableUnmandatory[1]]),
                status: gameEnum.GAME_STATUS_CREATING,
                privacy: gameEnum.GAME_STATUS_CREATING,
                creator: user.userId,
                step: 0,
                nextStep: 1,
                gameCreationDate: Date.now()
            };

            //Create the game
            let game = {};
            try {
                game = await gameDAO.createGame(gameToCreate, user);
            } catch (err) {
                return reject(err);
            }

            //modify the user with the gameId
            try {
                await userDAO.putUser({ ...user, gameId: game.gameId });
            } catch (err) {
                return reject(err);
            }

            await messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: gameEnum.WELCOME_MESSAGE, receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE);


            //TODO: Si la partie est public Emettre une websocket pour prévenir qu'il y a une nouvelle partie disponible

            resolve(game);
        })
    }

    updateGameRules = (gameRulesToUpdate, connectionId) => {
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
            let allGameData = {};
            try {
                allGameData = await gameDAO.getGameById(senderPlayer.gameId)
            } catch (err) {
                return reject(err);
            }
            //

            //we retrieve all the data
            const game = retrieveTheGame(allGameData)
            const players = retrievePlayers(allGameData);
            const playerToSend = players.filter(player => player.userId !== senderPlayer.userId);
            //

            //We check if the player have the right to update the gameInfo
            if (senderPlayer.userId !== game.creator) {
                return reject("the player don't have the right to modify this game");
            }
            //

            //We update the game rules
            game.numberPlayerToStart = gameRulesToUpdate.numberPlayerToStart;
            game.rolesChoosen = gameRulesToUpdate.rolesChoosen;

            try {
                await gameDAO.updateGame(game);
            } catch (err) {
                return resolve(err);
            }
            //

            // Send message to all players with the refresh data
            let promisesAllPlayers = [];
            playerToSend.forEach((player) => {
                promisesAllPlayers.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                    action: gameEnum.EVENT_REFRESH_GAME_DATA,
                    value: { gameInfos: game }
                })));
            });
            try {
                await Promise.all(promisesAllPlayers);
            } catch (err) {
                reject(err);
            }
            //

            //If the game hasn't started
            if (game.step === 0) {
                // We inform system the sender player is ready
                try {
                    await courseOfPlayService.handleGameAction({ name: "NEXT" }, connectionId);
                } catch (err) {
                    return reject(err);
                }
                //
                return resolve();
            }

            //If the game has started we need to reset it
            try {
                await cancelStartingGame(players, game);
            } catch (err) {
                reject(err);
            }

            resolve();
        });
    }

    fetchDataGame = (connectionId) => {
        return new Promise(async (resolve, reject) => {

            //Fetch the player
            let senderPlayer = {};
            try {
                senderPlayer = await gameDAO.getPlayerByConnectionId(connectionId);
            } catch (err) {
                return reject(err);
            }
            if (senderPlayer === undefined) {
                await apigatewayConnector.generateSocketMessage(connectionId, JSON.stringify({
                    action: gameEnum.ERROR_REFRESH_GAME_DATA,
                    value: { errorMessage: "the player is not present in any game" }
                }));
                return reject('the player is not present in any game');
            }
            //

            //Fetch game information
            let gameInfos = {};
            try {
                gameInfos = await gameDAO.getGameById(senderPlayer.gameId)
            } catch (err) {
                return reject(err);
            }
            //

            //We retrieve all the public messages, players, playerRole and actions and those intended for the player
            const game = retrieveTheGame(gameInfos)
            const messages = gameInfos.filter(elmt => elmt.sortId.includes("GameInfo_Message_") && (elmt.receiver === "ALL" || elmt.receiver === senderPlayer.userId || elmt.sender === senderPlayer.userId));
            const gameActions = gameInfos.filter(elmt => elmt.sortId.includes("GameInfo_Action_") && (elmt.receiver === "ALL" || elmt.receiver === senderPlayer.userId || elmt.sender === senderPlayer.userId));
            let players = retrievePlayers(gameInfos);
            const rolePlayer = retrieveRolePlayerByUserId(gameInfos, senderPlayer.userId, game.round);
            const witnessQuestion = rolePlayer && rolePlayer.roleName === "WITNESS" ? retrieveWitnessQuestion(gameInfos, game.round) : undefined;
            //

            try {
                await apigatewayConnector.generateSocketMessage(senderPlayer.connectionId, JSON.stringify({
                    action: gameEnum.EVENT_REFRESH_GAME_DATA,
                    value: { players: players, gameInfos: game, messages: messages, gameActions: gameActions, rolePlayer: rolePlayer, witnessQuestion: witnessQuestion }
                }));
            } catch (err) {
                reject(err)
            }
            //

            resolve();

        });
    }

    joinGame = (userId, gameId, connectionId) => {
        return new Promise(async (resolve, reject) => {

            //Retreive the user and information about the game
            let user = {};
            let game = {};
            let gameInfos = {};
            try {
                const fetchdata = await Promise.all([userDAO.getUserById(userId), gameDAO.getGameById(gameId)])
                user = fetchdata[0];
                gameInfos = fetchdata[1];
                game = retrieveTheGame(gameInfos)
            } catch (err) {
                return reject(err);
            }
            //

            //Get all players of the game
            const players = retrievePlayers(gameInfos);
            //

            //We retrieve a potential existing player 
            const findPlayer = retrievePlayerByUserId(gameInfos, user.userId);
            //

            //If it's a new player we check if there's any place left 
            if (findPlayer === undefined && players.length + 1 > game.numberPlayerToStart) {
                try {
                    await apigatewayConnector.closeConnection(connectionId);
                } catch (err) {
                    return reject(err);
                }
                //TODO gérer l'envoie d'un message socket pour dire que c'est complet
                return reject('the game is full');
            }
            //

            let newPlayer = {};
            if (findPlayer === undefined) {
                //We create the new player in database 
                newPlayer = {
                    gameId: gameId,
                    userId: userId,
                    connectionId: connectionId,
                    username: user.username,
                    character: user.character,
                    isConnected: true
                }

                //Create the player for this game 
                try {
                    newPlayer = await gameDAO.createPlayer(newPlayer);
                } catch (err) {
                    return reject(err);
                }
            } else {
                //if the player is already in the game we update his connectionId and player role connectionId and close the precedent connection
                const lastConnectionId = findPlayer.connectionId;
                newPlayer = { ...findPlayer, isConnected: true, connectionId: connectionId };

                const promiseUpdatePlayer = [];
                promiseUpdatePlayer.push(gameDAO.updatePlayer(newPlayer))
                promiseUpdatePlayer.push(apigatewayConnector.closeConnection(lastConnectionId));
                const rolePlayer = retrieveRolePlayerByUserId(gameInfos, newPlayer.userId, game.round);
                if (rolePlayer !== undefined) {
                    promiseUpdatePlayer.push(gameDAO.updateRolePlayer({ ...rolePlayer, connectionId: newPlayer.connectionId }));
                }
                try {
                    const result = await Promise.all(promiseUpdatePlayer);
                    newPlayer = result[0];
                } catch (err) {
                    return resolve(err);
                }
            }
            //

            // Send message to all other player in the game to inform a new player join the game
            let promisesAllPlayers = [];
            players.map((player) => {
                promisesAllPlayers.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                    action: gameEnum.EVENT_PLAYER_JOIN,
                    value: newPlayer
                })));
            });
            promisesAllPlayers.push(messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [newPlayer.username, gameEnum.PLAYER_JOIN_MESSAGE], receiver: "ALL" }, newPlayer.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE));
            try {
                await Promise.all(promisesAllPlayers);
            } catch (err) {
                reject(err)
            }
            //  

            resolve(gameInfos);
        })
    }

    userQuitGame = (connectionId) => {
        return new Promise(async (resolve, reject) => {

            //Fetch the player
            let playerLeft = {};
            try {
                playerLeft = await gameDAO.getPlayerByConnectionId(connectionId);
            } catch (err) {
                return reject(err);
            }

            if (playerLeft === undefined) {
                return reject('the player is not present in any game');
            }
            //

            //fetch game and information
            let gameInfos = {};
            let game = {};
            try {
                gameInfos = await gameDAO.getGameById(playerLeft.gameId);
                game = retrieveTheGame(gameInfos);
            } catch (err) {
                return reject(err);
            }
            //

            const playersInGame = gameInfos.filter(elmt => elmt.sortId.includes(tableEnum.SORT_ID_GAME_INFO_PLAYER) && elmt.connectionId !== playerLeft.connectionId);

            //If the game isn't started we delete the player 
            if (game.status === gameEnum.GAME_STATUS_CREATING) {
                try {
                    await gameDAO.deletePlayer(playerLeft)
                } catch (err) {
                    return reject(err);
                }
                //If the game is ready (just before start the game)
                if (game.step !== 0) {
                    //we need to reset it
                    try {
                        await cancelStartingGame(playersInGame, game);
                    } catch (err) {
                        reject(err);
                    }
                }
            } else {
                //we modify the player status to specify it's not connected
                try {
                    await gameDAO.updatePlayer({ ...playerLeft, isConnected: false });
                } catch (err) {
                    return reject(err);
                }
            }


            // Send message to all Player in the game to inform a player left the game
            let promises = [];
            playersInGame.map(async (player) => {
                promises.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                    action: gameEnum.EVENT_PLAYER_LEFT,
                    value: playerLeft
                })));
            });
            promises.push(messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [playerLeft.username, gameEnum.PLAYER_LEFT_MESSAGE], receiver: "ALL" }, playerLeft.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE));
            try {
                await Promise.all(promises);
            } catch (err) {
                reject(err)
            }
            //

            resolve();
        })
    }


}

const GAME_SERVICE = new gameService();
module.exports.gameService = GAME_SERVICE;
