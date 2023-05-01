'use strict';

const adminService = require('./../services/admin.service');
const httpService = require('./../services/http.service');

/**
 * Create a game and returns all relevant information to its creation
 * @param {} event 
 * @param {*} context 
 */
const populateGameEngine = async (event, context) => {

    try {
        await adminService.populateGameEngine();
    } catch (err) {
        console.error(err);
        return httpService.defaultError({ error: 'unable to fetch the user from the token' });
    }

    return httpService.defaultError({ success: 'game engine populated' });
};

module.exports = {
    populateGameEngine
};
