'use strict';

var kms;
var qs = require('qs');
var Commands = require('./commands');
var PagerDuty = require('./pagerduty');
var Slack = require('./slack');

var expectedSlackToken;
var expectedStage;
var commands;

const configurations = {
    dev: {
        kmsEncryptedSlackToken: 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAHYwdAYJKoZIhvcNAQcGoGcwZQIBADBgBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDFD58+o5yu4L04lu5wIBEIAzOqLZJKM0ZfU44hgPxf4350eflkysYArUWEInVzLXSpvZw0QFGpvbshlnT3shlEBhkhJb',
        kmsEncryptedPagerDutyApiToken: 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAHIwcAYJKoZIhvcNAQcGoGMwYQIBADBcBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDMFCTzw6XUbb/kSldwIBEIAv+dvB02nXz+HUZPz9l63yvLWf2LEUXWLBrRUOND2NFnIVqvhXUzWH+4XdAYW+Seg=',
        kmsEncryptedSlackApiToken: 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAJQwgZEGCSqGSIb3DQEHBqCBgzCBgAIBADB7BgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDLmxSsdkTpIMZK7GXQIBEIBOFUrRe5LEj+XplKEoMl7jwFCjNmigKxCmgTikvPcxTF55/1yR2RLbL2igEKKJiGrVOMJMZUSXuwGFvh/rzzOMna5G3g4bV9BhD9tLlvdr',
    },
    prod: {
        kmsEncryptedSlackToken: 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAHYwdAYJKoZIhvcNAQcGoGcwZQIBADBgBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDqr/ncrV6LlZ4vFogIBEIAzSM1CVwZ0LVuPLrWaLXqNqLoXLokhzNxKhGssXtfxW3xuvoI9F4Hsd3YPDuQReIiQcAm0',
        kmsEncryptedPagerDutyApiToken: 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAHIwcAYJKoZIhvcNAQcGoGMwYQIBADBcBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDIOevGLdXkHnRHOo1wIBEIAvWbNsvZy6nVPfu/8L0lMJvonVuUJMg+9mR7ahk6dO7FLguCDOvD1rfLFpQ1zB2rE=',
        kmsEncryptedSlackApiToken: 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAJEwgY4GCSqGSIb3DQEHBqCBgDB+AgEAMHkGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMFNxOnDzoXpTIlnVfAgEQgExGWdLo1NSW+2QRG2kTD38XLygw22wskIEe8hNiEWn4ibD83lcKxvP7KvRluI2vLhBRRlTCMo4skiFIGUSI9jETC55stGcbnBKWTpvJ',
    },
};

function kmsDecrypt(encryptedBase64String) {

    if (!kms) {
        try {
            var AWS = require('aws-sdk');
            kms = new AWS.KMS();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    var encryptedBuffer = new Buffer(encryptedBase64String, 'base64');
    var cipherText = { CiphertextBlob: encryptedBuffer };

    return new Promise(function (resolve, reject) {
        kms.decrypt(cipherText, function (err, data) {
            if (err) {
                return reject(new Error('Decrypt error: ' + err));
            } else {
                var decryptedString = data.Plaintext.toString('ascii');
                return resolve(decryptedString);
            }
        });
    });
}

function createRecurseFunction(lambdaContext, event) {
    return function recurse(commandName, commandArgument) {
        var AWS = require('aws-sdk');
        var lambda = new AWS.Lambda();

        var payload = {
            stage: event.stage,
            hasRecursed: true,
            commandName: commandName,
            commandArgument: commandArgument,
        };

        return new Promise(function (resolve, reject) {

            lambda.invoke({
                FunctionName: lambdaContext.functionName,
                Qualifier: lambdaContext.functionVersion,
                InvocationType: 'Event',
                Payload: JSON.stringify(payload),
            }, function (err, data) {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });

        });

    };
}

exports.handler = function (event, context, callback) {
    if (expectedSlackToken && commands && expectedStage === event.stage) {
        // Container reuse, simply process the event with the key in memory
        return processEvent(event, callback);
    }

    if (!event.stage || !configurations.hasOwnProperty(event.stage)) {
        return callback(new Error(`Invalid stage "${event.stage}".`));
    }
    expectedStage = event.stage;
    var config = configurations[event.stage];

    var promises = [Promise.resolve()];

    if (!expectedSlackToken) {
        promises.push(
            kmsDecrypt(config.kmsEncryptedSlackToken)
                .then(function (result) {
                    expectedSlackToken = result;
                })
        );
    }

    if (!commands) {
        promises.push(
            Promise.all([
                kmsDecrypt(config.kmsEncryptedPagerDutyApiToken),
                kmsDecrypt(config.kmsEncryptedSlackApiToken),
            ])
                .then(function (results) {
                    var pagerDutyApiToken = results[0];
                    var slackApiToken = results[1];
                    var recurseFunction = createRecurseFunction(context, event);
                    var pagerDuty = new PagerDuty(pagerDutyApiToken);
                    var slack = new Slack(slackApiToken);
                    commands = new Commands(pagerDuty, slack, recurseFunction);
                })
        );
    }

    Promise.all(promises)
        .then(function () {
            return processEvent(event, callback);
        })
        .catch(function (err) {
            return callback(err);
        });

};

function processEvent(event, callback) {

    if (event.hasRecursed && event.commandName && event.commandArgument) {
        if (!commands.hasOwnProperty(event.commandName)) {
            return callback(new Error(`Invalid command name "${event.commandName}".`));
        }
        commands[event.commandName](event.commandArgument);
        return callback();
    }

    var body = event.body;
    var params = qs.parse(body);
    var requestToken = params.token;
    if (requestToken !== expectedSlackToken) {
        console.error("Request token (" + requestToken + ") does not match expected");
        return callback(new Error('Invalid request token'));
    }

    commands.processCommand(params)
        .then(function (result) {
            return callback(null, result);
        }, function (err) {
            return callback(err);
        });
}
exports.processEvent = processEvent;
