'use strict';
const fetch = require('node-fetch');
const jose = require('node-jose');
const CONSTANTS = require('./../constants');


class TokenService {
    constructor() {
    }

    extractUser = (token) => {
        return new Promise(async (resolve, reject) => {
            try {
                const data = await this.parseToken(token);
                const user = {
                    userId: data.sub,
                    username: data.nickname,
                    email: data.email,
                    profile: data.profile,
                }
                resolve(user);
            } catch (err) {
                reject(err);
            }
        });
    }


    parseToken = (token) => {
        return new Promise(async (resolve, reject) => {
            if (!token) {
                return reject('Unauthorized');
            }

            // Get the kid from the headers prior to verification
            const sections = token.split('.');
            let header = jose.util.base64url.decode(sections[0]);
            try {
                header = JSON.parse(header);
            } catch (err) {
                return reject('Unauthorized');
            }
            const kid = header.kid;

            // Fetch known valid keys
            const rawRes = await fetch(CONSTANTS.KEYS_URL);
            const response = await rawRes.json();

            if (!rawRes.ok) {
                return reject('Unauthorized');
            }

            const keys = response['keys'];
            const foundKey = keys.find((key) => key.kid === kid);

            if (!foundKey) {
                return reject('Public key not found in jwks.json');
            }
            try {
                const result = await jose.JWK.asKey(foundKey);
                const keyVerify = jose.JWS.createVerify(result);
                const verificationResult = await keyVerify.verify(token);
                const claims = JSON.parse(verificationResult.payload);
                resolve(claims);
            } catch (error) {
                console.error('Unable to verify token', error);
                reject('Signature verification failed');
            }
        });
    }
}

const TOKEN_SERVICE = new TokenService();
module.exports = TOKEN_SERVICE;
