'use strict';

const userDao = require('./../dao/user.dao');

class userService {
    constructor() {
    }

    createUser = (user) => {
        return new Promise(async (resolve, reject) => {
            try {
                const userSaved = await userDao.putUser(user);
                resolve(userSaved);
            } catch (err) {
                reject(err);
            }
        })
    }

}

const USER_SERVICE = new userService();
module.exports = USER_SERVICE;
