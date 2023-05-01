'use strict';

const cognitoConnector = require('./../connector/cognito.connector');
const tokenService = require('../services/token.service');
const userService = require('../services/user.service');
const httpService = require('./../services/http.service');
const tableEnum = require('./../enums/table.enum');
const CONSTANTS = require('./../constants');

const authWebsocket = async (event, context) => {
    // Read input parameters from event
    const methodArn = event.methodArn;
    const token = event.queryStringParameters.Authorizer;

    let claims = null;
    try {
        claims = await tokenService.parseToken(token);
    } catch (error) {
        context.fail(error);
    }

    // Verify the token expiration
    const currentTime = Math.floor(new Date() / 1000);
    if (currentTime > claims.exp) {
        console.error('Token expired!');
        return context.fail('Token expired!');
    }

    if (claims.aud !== CONSTANTS.COGNITO_USER_POOL_CLIENT) {
        console.error('Token wasn\'t issued for target audience');
        return context.fail('Token was not issued for target audience');
    }

    return context.succeed(httpService.generateAllow('me', methodArn));
};

const refreshToken = async (event, context) => {
    try {
        const data = JSON.parse(event.body);

        const user = data.user;
        const refresh = data.refresh;

        if (!user || !refresh) {
            return httpService.defaultError({ error: 'The user and token to be refreshed must be provided.' });
        }

        const result = await cognitoConnector.refreshToken(user, refresh);
        const response = {
            token: result.tokenId,
            refresh: result.refreshToken,
            user: user
        };

        return httpService.defaultSuccess(response);
    } catch (error) {
        console.error(error);
        return httpService.defaultError({ error: 'Unable to refresh user token using AWS Cognito' });
    }
};


const signup = async (event, context) => {

    const data = JSON.parse(event.body);

    const username = data.username;
    const email = data.email;
    const password = data.password;

    try {
        const result = await cognitoConnector.signup(username, email, password);
        return httpService.defaultSuccess(result);
    } catch (err) {
        console.error(err);
        return httpService.defaultError(err);
    }

};

const onSignup = async (event, context) => {

    if (!event.request.userAttributes.sub) {
        // Nothing to do, the user's email ID is unknown
        console.error("userAttributes is missing");
        return context.done(null, event);
    }

    if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
        //Nothing to do
        return context.done(null, event);
    }

    const user = {
        userId: event.userName,
        username: event.request.userAttributes.nickname,
        character: "tate",
        profile: tableEnum.VALUE_PREMIUM,
    }

    try {
        await userService.createUser(user);
    } catch (err) {
        context.fail(err);
    }

    console.log("Success: user created")
    return context.done(null, event);
}

module.exports = {
    authWebsocket,
    refreshToken,
    onSignup,
    signup
};


