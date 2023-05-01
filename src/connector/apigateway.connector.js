'use strict';

const aws = require('aws-sdk');

const CONSTANTS = require('./../constants');
const dynamodbConnector = require('./dynamodb.connector');

class ApiGatewayConnector {
    constructor() {
        const CONNECTOR_OPTS = {
            apiVersion: '2018-11-29',
            endpoint: CONSTANTS.WEBSOCKET_API_ENDPOINT
        };
        this._connector = new aws.ApiGatewayManagementApi(CONNECTOR_OPTS);
    }

    async generateSocketMessage(connectionId, data) {
        try {
            return await this._connector.postToConnection({
                ConnectionId: connectionId,
                Data: data
            }).promise();
        } catch (error) {
            console.error('Unable to generate socket message', error);
            if (error.statusCode === 410) {
                console.log(`Removing stale connector ${connectionId}`);
            }
        }
    }

    async closeConnection(connectionId) {
        try {
            return await this._connector.deleteConnection({
                ConnectionId: connectionId,
            }).promise();
        } catch (error) {
            if (error.message === '410') {
                return console.log('the connection is already closed');
            }
            console.error('Unable to delete socket connection', error);
        }
    }
}

const APIGW_CONNECTOR = new ApiGatewayConnector();
module.exports = APIGW_CONNECTOR;
