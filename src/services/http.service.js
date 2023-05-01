'use strict';

const CONSTANTS = require('./../constants');

class HttpService {
    constructor() {
    }

    defaultSuccess = (body) => {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': CONSTANTS.CORS_ORIGIN
            },
            body: JSON.stringify(body)
        }
    }

    defaultError = (body, errorCode) => {
        const statusCode = errorCode ? errorCode : 500;
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': CONSTANTS.CORS_ORIGIN
            },
            body: JSON.stringify(body)
        }
    }

    generatePolicy = (principalId, effect, resource) => {
        const authResponse = {};
        authResponse.principalId = principalId;
        if (effect && resource) {
            const policyDocument = {};
            // default version
            policyDocument.Version = "2012-10-17";
            policyDocument.Statement = [];
            const statementOne = {};
            // default action
            statementOne.Action = "execute-api:Invoke";
            statementOne.Effect = effect;
            statementOne.Resource = resource;
            policyDocument.Statement[0] = statementOne;
            authResponse.policyDocument = policyDocument;
        }
        return authResponse;
    }

    generateAllow = (principalId, resource) => {
        return this.generatePolicy(principalId, "Allow", resource);
    }

    generateDeny = (principalId, resource) => {
        return this.generatePolicy(principalId, "Deny", resource);
    }

}

const HTTP_SERVICE = new HttpService();
module.exports = HTTP_SERVICE;
