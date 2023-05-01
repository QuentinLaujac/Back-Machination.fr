'use strict';

const gameEngine = require('./../dao/gameEngine.dao');

class adminService {
    constructor() {
    }

    populateGameEngine = (user) => {
        return new Promise(async (resolve, reject) => {
            try {
                const userSaved = await gameEngine.populate();
                resolve(userSaved);
            } catch (err) {
                reject(err);
            }
        })
    }

}

const ADMIN_SERVICE = new adminService();
module.exports = ADMIN_SERVICE;
