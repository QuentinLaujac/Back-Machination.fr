'use strict';

const gameDAO = require('../dao/game.dao');
const gameEngineDAO = require('../dao/gameEngine.dao');
const gameEnum = require('../enums/game.enum');
const apigatewayConnector = require('../connector/apigateway.connector');
const messageService = require('./message.service');
const { retrieveTheGame, retrievePlayers, retrieveRolePlayers, retrievePlayerByUserId, retrievePlayerByRole, retrieveRoleByPlayer, slugify } = require('../useful');

const proceedNextAction = (senderPlayer, game, players, gameInfos) => {
    return new Promise(async (resolve, reject) => {

        //Get all action we have to do 
        let gameEngine = null;
        try {
            gameEngine = await gameEngineDAO.getDataGame();
        } catch (err) {
            return reject(err);
        }
        const actionsToDo = gameEngine.filter(elmt => elmt.sortId.includes("DataGame_course_of_play_step" + game.nextStep + "_"));

        if (!Array.isArray(actionsToDo) || actionsToDo.length === 0) {
            //TODO MANAGE END GAME
            return resolve("End game");
        }
        //

        //Do those actions
        const actionsToPromise = [];
        actionsToDo.forEach((action, i) => {
            switch (action.target) {
                case "ALL":
                    actionsToPromise.push(courseOfPlayFunctions[action.function]([...players], { ...game }, action.duration));
                    break;
                default:
                    const rolesTargets = JSON.parse(action.target);
                    const playersTarget = [];
                    rolesTargets.forEach(roleTarget => {
                        const player = retrievePlayerByRole(gameInfos, game.round, roleTarget);
                        if (player !== undefined) {
                            playersTarget.push(player);
                        }
                    })
                    actionsToPromise.push(courseOfPlayFunctions[action.function]([...playersTarget], { ...game }, action.duration, [...players], action.totalDuration));
                    break;
            }
        })

        try {
            await Promise.all(actionsToPromise);
        } catch (err) {
            return reject(err);
        }

        // we need to retrieve the updated data again. 
        let refreshGameInfo = {};
        try {
            refreshGameInfo = await gameDAO.getGameById(senderPlayer.gameId)
        } catch (err) {
            return reject(err);
        }
        const refreshPlayer = retrievePlayers(refreshGameInfo);
        const refreshGame = retrieveTheGame(refreshGameInfo);
        //


        //Update the game with the new step and update players with a false ok next
        const updatePromise = [];
        // Manage the All IN ROW
        const nextStep = (!refreshGame.needChangeNextStep) ? actionsToDo[actionsToDo.length - 1].nextStep : refreshGame.nextStep;
        //
        updatePromise.push(gameDAO.updateGame({ ...refreshGame, step: refreshGame.nextStep, nextStep: nextStep, needChangeNextStep: false }));
        refreshPlayer.forEach(player => updatePromise.push(gameDAO.updatePlayer({ ...player, ...{ okNext: false } })));

        try {
            await Promise.all(updatePromise);
        } catch (err) {
            return reject(err);
        }

        return resolve();
    });
}

const courseOfPlayFunctions = [];
courseOfPlayFunctions["INIT_GAME"] = (players, game, duration) => {
    return new Promise(async (resolve, reject) => {
        const updateGamePromise = gameDAO.updateGame({ ...game, round: 1, stepName: "INIT_GAME", stepDuration: duration });

        const sendSocketPromise = [];
        players.forEach(player => sendSocketPromise.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
            action: gameEnum.GAME_ACTION,
            type: gameEnum.GAME_INIT,
            value: { duration: duration }
        }))));

        try {
            await Promise.all([...sendSocketPromise, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        return resolve();
    });
};

courseOfPlayFunctions["LAUNCH_GAME"] = (players, game) => {
    return new Promise(async (resolve, reject) => {
        const newGameValue = { ...game, status: gameEnum.GAME_STATUS_IN_PROGRESS, stepName: "LAUNCH_GAME", stepDuration: 0 };
        const updateGamePromise = gameDAO.updateGame(newGameValue);

        const sendSocketPromise = [];
        players.forEach(player => sendSocketPromise.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
            action: gameEnum.EVENT_REFRESH_GAME_DATA,
            value: { gameInfos: newGameValue, players: players }
        }))));

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: gameEnum.LAUNCH_GAME, receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)

        try {
            await Promise.all([...sendSocketPromise, updateGamePromise, logActionInMessage]);
        } catch (err) {
            return reject(err);
        }

        return resolve();
    });
};

courseOfPlayFunctions["ROLE_ALLOCATION"] = (players, game, duration) => {
    return new Promise(async (resolve, reject) => {
        let allRoles = [];
        try {
            allRoles = [...JSON.parse(game.rolesMandatory), ...JSON.parse(game.rolesChoosen)];
        } catch (err) {
            return reject(err);
        }

        let gameInfos = null;
        try {
            gameInfos = await gameDAO.getGameById(game.gameId);
        } catch (err) {
            return reject(err);
        }

        const newGameValue = { ...game, stepName: "ROLE_ALLOCATION", stepDuration: duration, canAskCrimeElement: true };
        const promiseAffectRole = [];

        const roleUsers = [];
        //We define roles for each users
        players.forEach(player => {
            const indexRole = Math.floor(Math.random() * allRoles.length);
            const role = allRoles[indexRole];
            allRoles.splice(indexRole, 1);
            roleUsers.push({ ...role, userId: player.userId });
        });
        //

        players.forEach(player => {

            const role = roleUsers[roleUsers.findIndex(role => role.userId === player.userId)];
            const precedentRole = game.round > 1 ? retrieveRoleByPlayer(gameInfos, player, game.round - 1) : { points: 0 };
            const guiltyUserId = roleUsers[roleUsers.findIndex(role => role.role === "GUILTY")].userId;

            const rolePlayer = {
                username: player.username,
                roleName: role.role,
                gameId: game.gameId,
                round: game.round,
                points: precedentRole.points,
                powerUsed: false,
                userId: player.userId,
                connectionId: player.connectionId,
                guiltyUserId: role.role === "PARTNER" ? guiltyUserId : undefined
            }

            promiseAffectRole.push(gameDAO.updatePlayer({ ...player, isWitness: role.role === "WITNESS" }));
            promiseAffectRole.push(gameDAO.createRolePlayer(rolePlayer));
            promiseAffectRole.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.GAME_ROLE_ALLOCATION,
                value: { duration: duration, roleName: rolePlayer.roleName, guiltyUserId: guiltyUserId, points: rolePlayer.points, powerUsed: rolePlayer.powerUsed, round: rolePlayer.round }
            })));
            promiseAffectRole.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.EVENT_REFRESH_GAME_DATA,
                value: { gameInfos: newGameValue }
            })));
        });

        promiseAffectRole.push(gameDAO.updateGame(newGameValue))
        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: gameEnum.GAME_ROLE_ALLOCATION, receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE);

        try {
            await Promise.all([...promiseAffectRole, logActionInMessage]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["SHOW_WITNESS"] = (players, game, duration) => {
    return new Promise(async (resolve, reject) => {
        let gameInfos = null;
        try {
            gameInfos = await gameDAO.getGameById(game.gameId);
        } catch (err) {
            return reject(err);
        }

        const rolePlayers = retrieveRolePlayers(gameInfos, game.round);
        const witnessRolePlayer = rolePlayers[rolePlayers.findIndex(role => role.roleName === "WITNESS")]
        const playerWitness = retrievePlayerByUserId(gameInfos, witnessRolePlayer.userId);

        const sendSocketPromise = [];
        players.forEach(player => sendSocketPromise.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
            action: gameEnum.GAME_ACTION,
            type: gameEnum.SHOW_WITNESS,
            value: { duration: duration, player: { username: playerWitness.username, userId: playerWitness.userId } }
        }))));

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [playerWitness.username, gameEnum.SHOW_WITNESS], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: "SHOW_WITNESS", stepDuration: duration });
        try {
            await Promise.all([...sendSocketPromise, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["SHOW_EVIDENCE"] = (targetPlayers, game, duration, allPlayers) => {
    return new Promise(async (resolve, reject) => {

        let gameInfos = null;
        let evidences = null;
        const fetchPromise = [gameEngineDAO.getEvidences(), gameDAO.getGameById(game.gameId)];
        try {
            const result = await Promise.all(fetchPromise);
            evidences = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }

        //TODO: faire en sorte de ne pas récupérer 300 élement de la base mais de faire une requete plutot
        const evidence = evidences[Math.floor(Math.random() * evidences.length)]

        const roundCrimeElement = {
            ...evidence,
            gameId: game.gameId,
            round: game.round,
        }

        const promiseShowEvidence = [];
        promiseShowEvidence.push(gameDAO.createRoundCrimeElement(roundCrimeElement));
        allPlayers.forEach(player => {
            const indexPlayer = targetPlayers.findIndex(iPlayer => iPlayer.userId === player.userId);
            if (indexPlayer === -1) { //if the player is not the target we inform him/her of what other players are doing 
                promiseShowEvidence.push(gameDAO.updateRolePlayer({ ...retrieveRoleByPlayer(gameInfos, player, game.round), evidence_type: roundCrimeElement.type }))
                promiseShowEvidence.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                    action: gameEnum.GAME_ACTION,
                    type: gameEnum.SHOW_EVIDENCE,
                    value: { duration: duration, evidence_type: roundCrimeElement.type }
                })))
            } else {
                promiseShowEvidence.push(gameDAO.updateRolePlayer({ ...retrieveRoleByPlayer(gameInfos, player, game.round), evidence_fr: roundCrimeElement.evidence_fr, clue_fr: roundCrimeElement.clue_fr, evidence_type: roundCrimeElement.type }))
                promiseShowEvidence.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                    action: gameEnum.GAME_ACTION,
                    type: gameEnum.SHOW_EVIDENCE,
                    value: { duration: duration, evidence: roundCrimeElement, evidence_type: roundCrimeElement.type }
                })))
            }
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: gameEnum.SHOW_EVIDENCE, receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: "SHOW_EVIDENCE", stepDuration: duration });
        try {
            await Promise.all([...promiseShowEvidence, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["INTERROGATION_PHASE_1"] = (targetPlayers, game, duration, allPlayers, totalDuration) => {
    return new Promise(async (resolve, reject) => {

        let cpTargetPlayers = [];
        //If it's the first time of this step, we define the order in which the questions will be asked
        if (game.playersAllInRow === undefined || game.playersAllInRow === "") {
            //We make sure we ask as many questions as totalDuration permits. 
            const nbTurn = Math.floor(totalDuration / (duration * targetPlayers.length));
            for (let i = 0; i != nbTurn; i++) {
                targetPlayers.forEach(player => cpTargetPlayers.push(player))
            }
            //
        } else {
            cpTargetPlayers = JSON.parse(game.playersAllInRow);
        }
        const playerInterro = cpTargetPlayers.shift();
        const playersAllInRow = cpTargetPlayers.length > 0 ? JSON.stringify(cpTargetPlayers.map(player => { return { userId: player.userId, username: player.username } })) : "";

        const promiseInterro = [];
        allPlayers.forEach(player => {
            promiseInterro.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: player.userId === playerInterro.userId ? gameEnum.YOUR_TURN_INTERROGATION : gameEnum.INTERROGATION_PHASE_1,
                value: { duration: duration }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [playerInterro.username, gameEnum.INTERROGATION_PHASE_1], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: "INTERROGATION_PHASE_1", stepDuration: duration, playersAllInRow: playersAllInRow, playerIdInterro: playerInterro.userId, needChangeNextStep: playersAllInRow !== "" });
        try {
            await Promise.all([...promiseInterro, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["INTERROGATION_PHASE_2"] = (targetPlayers, game, duration) => {
    return new Promise(async (resolve, reject) => {

        const promiseInterro = [];
        targetPlayers.forEach(player => {
            promiseInterro.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.YOUR_TURN_INTERROGATION_PHASE2,
                value: { duration: duration }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [gameEnum.YOUR_TURN_INTERROGATION_PHASE2], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: gameEnum.YOUR_TURN_INTERROGATION_PHASE2, stepDuration: duration, playerIdInterro: "ALL" });
        try {
            await Promise.all([...promiseInterro, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["VOTE_GUILTY"] = (targetPlayers, game, duration) => {
    return new Promise(async (resolve, reject) => {

        const gameToUpdate = { ...game, stepName: gameEnum.VOTE_GUILTY, stepDuration: duration, canAskCrimeElement: false };

        const sendGameActions = [];
        targetPlayers.forEach(player => {
            sendGameActions.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.VOTE_GUILTY,
                value: { duration: duration }
            })))
            sendGameActions.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.EVENT_REFRESH_GAME_DATA,
                value: { gameInfos: gameToUpdate }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [gameEnum.VOTE_GUILTY], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame(gameToUpdate);
        try {
            await Promise.all([...sendGameActions, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["ROLE_PROPOSITION"] = (targetPlayers, game, duration, allPlayers) => {
    return new Promise(async (resolve, reject) => {

        const promiseInterro = [];
        allPlayers.forEach(player => {
            const playerTarget = targetPlayers.filter(playerTarget => playerTarget.userId === player.userId);
            promiseInterro.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: Array.isArray(playerTarget) && playerTarget.length > 0 ? gameEnum.YOUR_ROLE_PROPOSITION : gameEnum.ROLE_PROPOSITION,
                value: { duration: duration }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [gameEnum.ROLE_PROPOSITION], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: gameEnum.ROLE_PROPOSITION, stepDuration: duration });
        try {
            await Promise.all([...promiseInterro, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["SHOW_RESULTS"] = (targetPlayers, game, duration, allPlayers) => {
    return new Promise(async (resolve, reject) => {

        let gameInfos = null;
        try {
            gameInfos = await gameDAO.getGameById(game.gameId);
        } catch (err) {
            return reject(err);
        }

        //We check if players have correctly vote against the guilty
        const groupVotePlayer = [];
        retrieveRolePlayers(gameInfos, game.round).forEach(rolePlayerItem => {
            if (rolePlayerItem.voteGuiltyUserId) {
                groupVotePlayer[rolePlayerItem.voteGuiltyUserId] = groupVotePlayer[rolePlayerItem.voteGuiltyUserId] ? groupVotePlayer[rolePlayerItem.voteGuiltyUserId] + 1 : 1;
            }
        })
        groupVotePlayer.sort();
        const keysGroupVotePlayer = Object.keys(groupVotePlayer);
        const guilty = retrievePlayerByRole(gameInfos, game.round, "GUILTY");
        let playersHaveCorrectlyVoteForGuiltyPart = groupVotePlayer[keysGroupVotePlayer[keysGroupVotePlayer.length - 1]] === groupVotePlayer[guilty.userId] && groupVotePlayer[guilty.userId] !== undefined;
        //if there is equality, playersHaveCorrectlyVoteForGuiltyPart go false
        playersHaveCorrectlyVoteForGuiltyPart = keysGroupVotePlayer.length > 1 ? groupVotePlayer[keysGroupVotePlayer[keysGroupVotePlayer.length - 2]] !== groupVotePlayer[keysGroupVotePlayer[keysGroupVotePlayer.length - 1]] : playersHaveCorrectlyVoteForGuiltyPart;
        //

        //we check if a player has find the crime element
        const indexPlayersWhoFindCrimeElement = retrieveRolePlayers(gameInfos, game.round).findIndex(rolePlayerFilter => rolePlayerFilter.hasFoudCrimeElement);
        const someoneFindCrimeElement = indexPlayersWhoFindCrimeElement > -1;
        //

        const promiseSendData = [];
        const promisePlayerToUpdate = [];
        const resultToShow = [];
        //compute player points
        targetPlayers.forEach(player => {
            const rolePlayer = retrieveRoleByPlayer(gameInfos, player, game.round);
            const detailPoints = {};
            let points = rolePlayer.points;
            detailPoints["precedentPoints"] = rolePlayer.points;
            let newPoint = 0;
            switch (rolePlayer.roleName) {
                case "WITNESS":
                    // someone find crime element 
                    newPoint = someoneFindCrimeElement ? 1 : 0;
                    detailPoints["someoneFindCrimeElement"] = newPoint;
                    points += newPoint;

                    // have correctly vote against the guilty
                    newPoint = rolePlayer.voteGuiltyUserId === guilty.userId && playersHaveCorrectlyVoteForGuiltyPart ? 1 : 0;
                    detailPoints["playersHaveCorrectlyVoteForGuiltyPart"] = newPoint;
                    points += newPoint;
                    break;
                case "GUILTY":
                    // no one find the crime element
                    newPoint = someoneFindCrimeElement ? 0 : 1;
                    detailPoints["noOneFindCrimeElement"] = newPoint;
                    points += newPoint;

                    // no one have vote against the guilty
                    newPoint = playersHaveCorrectlyVoteForGuiltyPart ? -1 : 2;
                    detailPoints["noPlayersHaveCorrectlyVoteForGuiltyPart"] = newPoint;
                    points += newPoint;
                    break;
                case "PARTNER":
                    // no one find the crime element
                    newPoint = someoneFindCrimeElement ? 0 : 1;
                    detailPoints["noOneFindCrimeElement"] = newPoint;
                    points += newPoint;

                    // no one have vote against the guilty
                    newPoint = playersHaveCorrectlyVoteForGuiltyPart ? 0 : 1;
                    detailPoints["noPlayersHaveCorrectlyVoteForGuiltyPart"] = newPoint;
                    points += newPoint;
                    break;
                case "INSPECTOR":
                    // have foud crime element
                    newPoint = rolePlayer.hasFoudCrimeElement ? 1 : 0;
                    detailPoints["hasFoudCrimeElement"] = newPoint;
                    points += newPoint;

                    // have correcty vote against the guilty
                    newPoint = rolePlayer.voteGuiltyUserId === guilty.userId && playersHaveCorrectlyVoteForGuiltyPart ? 1 : 0;
                    detailPoints["playersHaveCorrectlyVoteForGuiltyPart"] = newPoint;
                    points += newPoint;

                    // have rightly proposed roles
                    const roleProposition = rolePlayer.roleProposition ? JSON.parse(rolePlayer.roleProposition) : [];
                    let nbCorrectRole = 0;
                    roleProposition.forEach(roleP => {
                        const playerR = retrievePlayerByUserId(gameInfos, roleP.userId);
                        const roleR = retrieveRoleByPlayer(gameInfos, playerR, game.round);
                        nbCorrectRole += roleP.roleName === roleR.roleName ? 1 : 0;
                    });
                    newPoint = (nbCorrectRole === roleProposition.length && roleProposition.length > 0) ? 2 : (nbCorrectRole > 0) ? -1 : -2;
                    detailPoints["correctRoleProposition"] = newPoint;
                    points += newPoint;
                    break;
            }

            resultToShow.push({ username: rolePlayer.username, points: points, roleName: rolePlayer.roleName, detailPoints: detailPoints });
            promisePlayerToUpdate.push(gameDAO.updateRolePlayer({ ...rolePlayer, points: points }));
            promiseSendData.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.EVENT_REFRESH_GAME_DATA,
                value: { rolePlayer: { ...rolePlayer, points: points } }
            })))
        });

        resultToShow.sort((rolePlayerA, rolePlayerB) => rolePlayerB.points - rolePlayerA.points);

        targetPlayers.forEach(player => {
            promiseSendData.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.SHOW_RESULTS,
                value: { duration: duration, roundResult: JSON.stringify(resultToShow) }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [resultToShow[0].username, gameEnum.SHOW_RESULTS], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: gameEnum.SHOW_RESULTS, stepDuration: duration, roundResult: JSON.stringify(resultToShow), nextStep: (game.round === 3) ? "14" : game.nextStep, needChangeNextStep: (game.round == 3) });
        try {
            await Promise.all([...promisePlayerToUpdate, ...promiseSendData, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        resolve();
    });
}

courseOfPlayFunctions["LAUNCH_NEXT_LEVEL"] = (targetPlayers, game, duration, allPlayers) => {
    return new Promise(async (resolve, reject) => {
        //Reset values
        const newGameValue = { ...game, stepName: "LAUNCH_NEXT_LEVEL", round: game.round + 1, stepDuration: 3, canAskCrimeElement: true, nextStep: "2", needChangeNextStep: true };
        const playersUpdate = [];
        const promiseUpdate = [];
        targetPlayers.forEach(player => {
            playersUpdate.push({ ...player, isWitness: false, nbVoteGuilty: 0 });
            promiseUpdate.push(gameDAO.updatePlayer({ ...player, isWitness: false, nbVoteGuilty: 0 }))
        })

        targetPlayers.forEach(player => promiseUpdate.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
            action: gameEnum.EVENT_REFRESH_GAME_DATA,
            value: { gameInfos: newGameValue, players: playersUpdate }
        }))));

        const updateGamePromise = gameDAO.updateGame(newGameValue);
        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [gameEnum.LAUNCH_NEXT_LEVEL], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)

        try {
            await Promise.all([...promiseUpdate, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        return resolve();
    });
}

courseOfPlayFunctions["SHOW_RESULTS_FINAL"] = (targetPlayers, game, duration) => {
    return new Promise(async (resolve, reject) => {

        let gameInfos = null;
        try {
            gameInfos = await gameDAO.getGameById(game.gameId);
        } catch (err) {
            return reject(err);
        }

        const results = retrieveRolePlayers(gameInfos, game.round).sort((roleA, roleB) => roleB.points - roleA.points).map(roleP => { return { username: roleP.username, points: roleP.points } });

        const promiseSendData = [];
        targetPlayers.forEach(player => {
            promiseSendData.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.SHOW_RESULTS_FINAL,
                value: { results: JSON.stringify(results) }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [results[0].username, gameEnum.SHOW_RESULTS_FINAL], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: gameEnum.SHOW_RESULTS_FINAL, stepDuration: duration, results: JSON.stringify(results) });
        try {
            await Promise.all([...promiseSendData, logActionInMessage, updateGamePromise]);
        } catch (err) {
            return reject(err);
        }

        return resolve();

    });
}


courseOfPlayFunctions["EVENT_ASK_WIKNESS"] = (connectionId, gameId, question) => {
    return new Promise(async (resolve, reject) => {

        //Fetch the sender player
        let senderPlayer = {};
        let gameInfos = {};
        try {
            const result = await Promise.all([gameDAO.getPlayerByConnectionId(connectionId), gameDAO.getGameById(gameId)]);
            senderPlayer = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }
        if (senderPlayer === undefined) {
            return reject('the player is not present in any game');
        }
        //

        const game = retrieveTheGame(gameInfos);

        const witness = retrievePlayerByRole(gameInfos, game.round, "WITNESS");
        if (witness === undefined) {
            return reject('there is no witness in the game');
        }

        let witnessQuestion = null;
        try {
            witnessQuestion = await gameDAO.createWitnessQuestion({ round: game.round, gameId: game.gameId, question: question, senderName: senderPlayer.username });
        } catch (err) {
            console.error(err);
            return reject(err);
        }

        try {
            await apigatewayConnector.generateSocketMessage(witness.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.QUESTION_WITNESS,
                value: witnessQuestion
            }))
        } catch (err) {
            console.error(err);
            return reject(err);
        }

        return resolve();
    });
}

courseOfPlayFunctions["EVENT_WITNESS_ANSWER"] = (connectionId, gameId, data) => {
    return new Promise(async (resolve, reject) => {

        //Fetch the sender player
        let senderPlayer = {};
        let gameInfos = {};
        try {
            const result = await Promise.all([gameDAO.getPlayerByConnectionId(connectionId), gameDAO.getGameById(gameId)]);
            senderPlayer = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }
        if (senderPlayer === undefined) {
            return reject('the player is not present in any game');
        }
        //

        const game = retrieveTheGame(gameInfos);
        const witness = retrieveRoleByPlayer(gameInfos, senderPlayer, game.round);
        if (witness.roleName === "WITNESS") {
            try {
                await Promise.all([
                    messageService.sendEventMessage({ messageType: "WITNESS_ANSWER", content: [data.senderName, data.question, data.answer], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE, data.senderName),
                    gameDAO.deleteWitnessQuestion({ gameId: game.gameId, round: game.round, questionId: data.questionId })
                ]);
            } catch (err) {
                console.error(err);
                return reject(err);
            }
        }

        return resolve();
    });
}
courseOfPlayFunctions["EVENT_VOTE_GUILTY"] = (connectionId, gameId, data) => {
    return new Promise(async (resolve, reject) => {

        //Fetch the sender player
        let senderPlayer = {};
        let gameInfos = {};
        try {
            const result = await Promise.all([gameDAO.getPlayerByConnectionId(connectionId), gameDAO.getGameById(gameId)]);
            senderPlayer = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }
        if (senderPlayer === undefined) {
            return reject('the player is not present in any game');
        }
        //

        //We can't vote for ourselves
        if (senderPlayer.userId === data.userId) {
            return resolve();
        }

        const game = retrieveTheGame(gameInfos);

        const rolePlayer = retrieveRoleByPlayer(gameInfos, senderPlayer, game.round);

        //Fetch the guilty vote player and the precedent guilty vote player
        let voteGuiltyPlayer = undefined;
        let precedentVoteGuiltyPlayer = undefined;
        try {
            const result = await Promise.all([
                gameDAO.getPlayerByUserIdAndGameId(data.userId, gameId),
                rolePlayer.voteGuiltyUserId ? gameDAO.getPlayerByUserIdAndGameId(rolePlayer.voteGuiltyUserId, gameId) : undefined
            ]);
            voteGuiltyPlayer = result[0];
            precedentVoteGuiltyPlayer = result.length > 1 ? result[1] : undefined;
        } catch (err) {
            return reject(err);
        }
        //

        //If we vote for the same player as before, we do nothing.
        if (precedentVoteGuiltyPlayer && precedentVoteGuiltyPlayer.userId === voteGuiltyPlayer.userId) {
            return resolve();
        }

        //Update players
        try {
            await Promise.all([
                gameDAO.updateRolePlayer({ ...rolePlayer, voteGuiltyUserId: data.userId }),
                gameDAO.updatePlayer({ ...voteGuiltyPlayer, nbVoteGuilty: voteGuiltyPlayer.nbVoteGuilty ? voteGuiltyPlayer.nbVoteGuilty + 1 : 1 }),
                precedentVoteGuiltyPlayer && precedentVoteGuiltyPlayer.nbVoteGuilty > 0 ? gameDAO.updatePlayer({ ...precedentVoteGuiltyPlayer, nbVoteGuilty: precedentVoteGuiltyPlayer.nbVoteGuilty - 1 }) : undefined
            ]);
        } catch (err) {
            return reject(err);
        }
        //

        //Send refresh players data
        let players = [];
        try {
            players = await gameDAO.getPlayersByGameId(gameId)
        } catch (err) {
            return reject(err);
        }
        const promiseRefreshData = [];
        players.forEach(player => promiseRefreshData.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
            action: gameEnum.EVENT_REFRESH_GAME_DATA,
            value: { players: players }
        }))))

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [senderPlayer.username, gameEnum.EVENT_VOTE_GUILTY, voteGuiltyPlayer.username], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)

        try {
            await Promise.all(promiseRefreshData, logActionInMessage);
        } catch (err) {
            console.error(err);
            return reject(err);
        }
        //

        return resolve();
    });
}

courseOfPlayFunctions["EVENT_ROLE_PROPOSITION"] = (connectionId, gameId, data) => {
    return new Promise(async (resolve, reject) => {

        //Fetch the sender player
        let senderPlayer = {};
        let gameInfos = {};
        try {
            const result = await Promise.all([gameDAO.getPlayerByConnectionId(connectionId), gameDAO.getGameById(gameId)]);
            senderPlayer = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }
        if (senderPlayer === undefined) {
            return reject('the player is not present in any game');
        }
        //

        const game = retrieveTheGame(gameInfos);
        const inspector = retrieveRoleByPlayer(gameInfos, senderPlayer, game.round);
        if (inspector.roleName !== "INSPECTOR") {
            //the player don't have the rules to send role proposition
            return resolve();
        }

        try {
            await gameDAO.updateRolePlayer({ ...inspector, roleProposition: JSON.stringify(data.rolePlayers) })
        } catch (err) {
            console.error(err);
            return reject(err);
        }

        return resolve();
    });
}

courseOfPlayFunctions["EVENT_PROPOSE_CRIME_ELEMENT"] = (connectionId, gameId, crimeElement) => {
    return new Promise(async (resolve, reject) => {

        //Fetch the sender player
        let senderPlayer = {};
        let gameInfos = {};
        try {
            const result = await Promise.all([gameDAO.getPlayerByConnectionId(connectionId), gameDAO.getGameById(gameId)]);
            senderPlayer = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }
        if (senderPlayer === undefined) {
            return reject('the player is not present in any game');
        }
        //

        const game = retrieveTheGame(gameInfos);
        const players = retrievePlayers(gameInfos);
        const rolePlayer = retrieveRoleByPlayer(gameInfos, senderPlayer, game.round);
        if (rolePlayer.roleName === "WITNESS" || rolePlayer.roleName === "GUILTY") {
            //the player don't have the rules to send crime element
            return resolve();
        }

        let roundCrimeElement = {};
        try {
            const result = await gameDAO.getRoundCrimeElement(gameId, game.round);
            roundCrimeElement = result[0];
        } catch (err) {
            console.error(err);
            return reject(err);
        }

        if (slugify(roundCrimeElement.evidence_fr.trim()) !== slugify(crimeElement.trim())) {
            try {
                await Promise.all([
                    apigatewayConnector.generateSocketMessage(senderPlayer.connectionId, JSON.stringify({
                        action: gameEnum.GAME_ACTION,
                        type: gameEnum.WRONG_CRIME_ELEMENT,
                        value: { duration: 10 }
                    })),
                    messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [senderPlayer.username, gameEnum.PLAYER_FAILURE_CRIME_ELEMENT], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE)
                ]);
                return resolve();
            } catch (error) {
                console.error(error);
                return reject(error);
            }
        }


        const promiseSendGameAction = [];
        players.forEach(player => {
            promiseSendGameAction.push(apigatewayConnector.generateSocketMessage(player.connectionId, JSON.stringify({
                action: gameEnum.GAME_ACTION,
                type: gameEnum.PLAYER_FIND_CRIME_ELEMENT,
                value: { duration: 10, username: senderPlayer.username, crimeElement: roundCrimeElement.evidence_fr }
            })))
        });

        const logActionInMessage = messageService.sendEventMessage({ messageType: "EVENT_MESSAGE", content: [senderPlayer.username, gameEnum.PLAYER_FIND_CRIME_ELEMENT, roundCrimeElement.evidence_fr], receiver: "ALL" }, game.gameId, gameEnum.GAME_RECEIVE_EVENT_MESSAGE);
        const updateGamePromise = gameDAO.updateGame({ ...game, stepName: "PLAYER_FIND_CRIME_ELEMENT", stepDuration: 10, nextStep: "10" });
        const updateRolePlayer = gameDAO.updateRolePlayer({ ...rolePlayer, hasFoudCrimeElement: true });
        try {
            await Promise.all([...promiseSendGameAction, logActionInMessage, updateGamePromise, updateRolePlayer]);
        } catch (err) {
            return reject(err);
        }

        return resolve();
    });
}

courseOfPlayFunctions["EVENT_NEXT"] = (connectionId, gameId) => {
    return new Promise(async (resolve, reject) => {

        //Fetch the sender player
        let senderPlayer = {};
        let gameInfos = {};
        const fetchPromise = [gameDAO.getPlayerByConnectionId(connectionId), gameDAO.getGameById(gameId)];
        try {
            const result = await Promise.all(fetchPromise);
            senderPlayer = result[0];
            gameInfos = result[1];
        } catch (err) {
            return reject(err);
        }
        if (senderPlayer === undefined) {
            return reject('the player is not present in any game');
        }
        //

        const players = retrievePlayers(gameInfos);
        const game = retrieveTheGame(gameInfos);

        //we count how many players said next
        let nbPlayerNext = 0;
        players.forEach(player => {
            if (player.userId === senderPlayer.userId) {
                player.okNext = true;
            }
            if (!player.isConnected) {
                player.okNext = true;
            }
            nbPlayerNext = player.okNext ? nbPlayerNext + 1 : nbPlayerNext
        })

        //If all players are ok
        if (nbPlayerNext >= game.numberPlayerToStart) {
            try {
                await proceedNextAction(senderPlayer, game, players, gameInfos);
            } catch (err) {
                return reject(err);
            }
        } else {
            //If the step is not complete 
            try {
                await gameDAO.updatePlayer({ ...senderPlayer, ...{ okNext: true } });
            } catch (err) {
                reject(err);
            }
        }

        return resolve();
    });
}

module.exports = courseOfPlayFunctions;
