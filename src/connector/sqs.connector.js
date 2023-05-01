'use strict';

const aws = require('aws-sdk');

const CONSTANTS = require('./../constants');

class SqsConnector {
    constructor() {
        this.sqs = new aws.SQS({ apiVersion: CONSTANTS.SQS_API_VERSION });
    }

    push = (senderPlayer, actionName, actionData) => {
        return new Promise((resolve, reject) => {

            let messAttributes = {
                senderId: {
                    DataType: "String",
                    StringValue: senderPlayer.connectionId
                },
                actionType: {
                    DataType: "String",
                    StringValue: actionName
                },
                gameId: {
                    DataType: "String",
                    StringValue: senderPlayer.gameId
                }
            }

            messAttributes = actionData ? { ...messAttributes, actionData: { DataType: "String", StringValue: JSON.stringify(actionData) } } : messAttributes;

            const params = {
                MessageAttributes: messAttributes,
                MessageDeduplicationId: actionName + "_" + senderPlayer.gameId + "_" + senderPlayer.connectionId + "_" + Date.now(),
                MessageGroupId: senderPlayer.gameId,
                MessageBody: actionName,
                QueueUrl: CONSTANTS.SQS_MESSAGE_QUEUE_URL
            };

            this.sqs.sendMessage(params, function (err, data) {
                if (err) {
                    console.error(err);
                    return reject(err);
                } else {
                    return resolve(data.MessageId);
                }
            });
        })
    }


    pull = () => {
        return new Promise((resolve, reject) => {
            const params = {
                AttributeNames: [
                    "senderId", "actionType", "gameId"
                ],
                MaxNumberOfMessages: 1,
                MessageAttributeNames: [
                    "All"
                ],
                QueueUrl: CONSTANTS.SQS_MESSAGE_QUEUE_URL,
                VisibilityTimeout: 0,
                WaitTimeSeconds: 0
            };

            this.sqs.receiveMessage(params, (err, data) => {
                if (err) {
                    console.error(err);
                    return reject(err);
                } else if (data.Messages) {
                    var deleteParams = {
                        QueueUrl: CONSTANTS.SQS_MESSAGE_QUEUE_URL,
                        ReceiptHandle: data.Messages[0].ReceiptHandle
                    };
                    this.sqs.deleteMessage(deleteParams, (err, data) => {
                        if (err) {
                            console.log("Delete Error", err);
                            return reject(err);
                        } else {
                            console.log("Message Deleted", data);
                            return resolve(data.Messages);
                        }
                    });
                }
            });
        })
    }

}



const SQS_CONNECTOR = new SqsConnector();
module.exports = SQS_CONNECTOR;
