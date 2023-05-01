'use strict';

const aws = require('aws-sdk');
const ddt = require('dynamodb-data-types');

const CONSTANTS = require('./../constants');

class DynamoDbConnector {
    constructor() {
        this.connector = new aws.DynamoDB.DocumentClient(CONSTANTS.DYNAMODB_OPTIONS);
        this.ddb = new aws.DynamoDB({ apiVersion: CONSTANTS.DYNAMODB_API_VERSION });
        this.attr = ddt.AttributeValue;
    }

    /**
     * Fetch items in data base
     * 
     * @param {*} partitionKeyName Required
     * @param {*} partitionKeyValue Required
     * @param {*} sortKeyName Required
     * @param {*} sortKeyValue Required
     * @param {*} GSIName Optionnal it's a secondary index
     */
    getItems = (partitionKeyName, partitionKeyValue, sortKeyName, sortKeyValue, GSIName) => {
        return new Promise((resolve, reject) => {
            const params = {
                TableName: CONSTANTS.DYNAMODB_TABLE,
                KeyConditionExpression: '#partitionKeyName = :partitionkeyval and begins_with(#sortKeyName, :substr)',
                ExpressionAttributeNames: {
                    '#partitionKeyName': partitionKeyName,
                    '#sortKeyName': sortKeyName,
                },
                ExpressionAttributeValues: {
                    ':partitionkeyval': partitionKeyValue,
                    ':substr': sortKeyValue,
                },
            }
            if (GSIName) {
                params.IndexName = GSIName;
            }
            this.connector.query(params, (err, data) => {
                if (err) {
                    console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    const user = data.Items;
                    resolve(user);
                }
            });
        });
    }

    /**
     * CREATE an element in database or UPDATE if exist
     * @param {*} item Object to create or update in database
     */
    putItem = (item) => {
        return new Promise(async (resolve, reject) => {
            const params = {
                TableName: CONSTANTS.DYNAMODB_TABLE,
                Item: item,
            };
            try {
                const data = await this.connector.put(params).promise();
                resolve(this.attr.unwrap(data.Item));
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }

    /**
    * DELETE an element in database
    * @param {*} item Object to delete in database
    */
    deleteItem = (item) => {
        return new Promise(async (resolve, reject) => {
            const params = {
                TableName: CONSTANTS.DYNAMODB_TABLE,
                Key: {
                    "partKey": item.partKey,
                    "sortId": item.sortId
                },
            };
            try {
                await this.connector.delete(params).promise();
                resolve();
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }

    removeAttribute = (item, attributes) => {
        return new Promise(async (resolve, reject) => {
            attributesString = attributes.map(attribute => " " + attribute + ",");
            const params = {
                TableName: CONSTANTS.DYNAMODB_TABLE,
                Key: {
                    "partKey": item.partKey,
                    "sortId": item.sortId
                },
                UpdateExpression: "remove " + attributesString,
            };
            try {
                await this.connector.delete(params).promise();
                resolve();
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }

}



const DYNAMODB_CONNECTOR = new DynamoDbConnector();
module.exports = DYNAMODB_CONNECTOR;
