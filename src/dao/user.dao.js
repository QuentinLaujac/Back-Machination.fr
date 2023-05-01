'use strict';

const dynamodbConnector = require('./../connector/dynamodb.connector');

const tableEnum = require('./../enums/table.enum');

class userDAO {
    constructor() {
    }

    putUser = (user) => {
        return new Promise(async (resolve, reject) => {
            try {
                await dynamodbConnector.putItem({ partKey: user.userId, sortId: tableEnum.SORT_ID_USER, ...user });
                resolve();
            } catch (err) {
                reject(err);
            }
        })
    }


    getUserById = (userId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const user = await dynamodbConnector.getItems(tableEnum.COLUMN_PART_KEY, userId, tableEnum.COLUMN_SORT_KEY, tableEnum.SORT_ID_USER);
                resolve(user[0]);
            } catch (err) {
                reject(err);
            }
        })
    }

}



const USER_DAO = new userDAO();
module.exports = USER_DAO;
