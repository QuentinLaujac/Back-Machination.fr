'use strict';

const tableEnum = require('./enums/table.enum');

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const retrieveTheGame = (gameInfos) => {
    const gameInfo = gameInfos.filter(elmt => elmt.sortId === tableEnum.SORT_ID_GAME);
    const game = (Array.isArray(gameInfo)) ? gameInfo[0] : gameInfo;
    if (game === undefined) {
        throw new Error('the game not exist');
    }
    return game;
}

const retrievePlayers = (gameInfos) => {
    const players = gameInfos.filter(elmt => elmt.sortId.includes("_Player_"));
    if (!Array.isArray(players)) {
        return [];
    }
    return players;
}

const retrieveRoundCrimeElement = (gameInfos, round) => {
    const roundCrimeElements = gameInfos.filter(elmt => elmt.sortId.includes(`${round}_CRIME_ELEMENT`));
    const roundCrimeElement = (Array.isArray(roundCrimeElements)) ? roundCrimeElements[0] : roundCrimeElements;
    if (roundCrimeElement === undefined) {
        throw new Error('the round crime element exist');
    }
    return roundCrimeElement;
}

const retrieveWitnessQuestion = (gameInfos, round) => {
    const witnessQuestions = gameInfos.filter(elmt => elmt.sortId.includes(`${round}_WITNESS_QUESTION_`));
    return (Array.isArray(witnessQuestions)) ? witnessQuestions : [];
}

const retrievePlayerByUserId = (gameInfos, userId) => {
    const player = retrievePlayers(gameInfos).filter(player => player.userId === userId);
    return (Array.isArray(player)) ? player[0] : player;
}

const retrieveRolePlayers = (gameInfos, round) => {
    const rolePlayer = gameInfos.filter(elmt => elmt.sortId.includes(`${round}_PLAYER_ROLE_`));
    if (!Array.isArray(rolePlayer) || rolePlayer.length === 0) {
        return [];
    }
    return rolePlayer;
}

const retrieveRoleByPlayer = (gameInfos, player, round) => {
    const rolePlayer = gameInfos.filter(elmt => elmt.sortId.includes(`${round}_PLAYER_ROLE_`) && elmt.userId === player.userId);
    if (!Array.isArray(rolePlayer) || rolePlayer.length === 0) {
        return undefined;
    }
    return rolePlayer[0];
}

const retrievePlayerByRole = (gameInfos, round, role) => {
    const rolePlayers = retrieveRolePlayers(gameInfos, round);
    const rolePlayer = rolePlayers.filter(roleP => roleP.sortId.includes(role))
    if (!Array.isArray(rolePlayer) || rolePlayer.length === 0) {
        return undefined;
    }
    const player = retrievePlayerByUserId(gameInfos, rolePlayer[0].userId);
    return player;
}

const retrieveRolePlayerByUserId = (gameInfos, userId, round) => {
    const rolePlayers = retrieveRolePlayers(gameInfos, round);
    const rolePlayer = rolePlayers.filter(player => player.userId === userId);
    return (Array.isArray(rolePlayer)) ? rolePlayer[0] : rolePlayer;
}

const slugify = (str) => {
    const map = {
        '-': ' ',
        '-': '_',
        'a': 'á|à|ã|â|À|Á|Ã|Â',
        'e': 'é|è|ê|É|È|Ê',
        'i': 'í|ì|î|Í|Ì|Î',
        'o': 'ó|ò|ô|õ|Ó|Ò|Ô|Õ',
        'u': 'ú|ù|û|ü|Ú|Ù|Û|Ü',
        'c': 'ç|Ç',
        'n': 'ñ|Ñ'
    };

    str = str.toLowerCase();

    for (let pattern in map) {
        str = str.replace(new RegExp(map[pattern], 'g'), pattern);
    };

    return str;
};

module.exports.slugify = slugify;
module.exports.asyncForEach = asyncForEach;
module.exports.retrieveTheGame = retrieveTheGame;
module.exports.retrievePlayers = retrievePlayers;
module.exports.retrievePlayerByUserId = retrievePlayerByUserId;
module.exports.retrieveRolePlayers = retrieveRolePlayers;
module.exports.retrieveRolePlayerByUserId = retrieveRolePlayerByUserId;
module.exports.retrieveRoundCrimeElement = retrieveRoundCrimeElement;
module.exports.retrievePlayerByRole = retrievePlayerByRole;
module.exports.retrieveRoleByPlayer = retrieveRoleByPlayer;
module.exports.retrieveWitnessQuestion = retrieveWitnessQuestion;
