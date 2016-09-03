'use strict';

var kms;
var qs = require('qs');
var Commands = require('./commands');
var PagerDuty = require('./pagerduty');
var slack = require('./slack');

var expectedSlackToken;
var commands;

const kmsEncryptedSlackToken = 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAHYwdAYJKoZIhvcNAQcGoGcwZQIBADBgBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDqr/ncrV6LlZ4vFogIBEIAzSM1CVwZ0LVuPLrWaLXqNqLoXLokhzNxKhGssXtfxW3xuvoI9F4Hsd3YPDuQReIiQcAm0';
const kmsEncryptedPagerDutyApiToken = 'AQECAHhUn6wKENLiOqxMUc4/sLItOcFx7tVRblgKtD0D9dIFYgAAAHIwcAYJKoZIhvcNAQcGoGMwYQIBADBcBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDIOevGLdXkHnRHOo1wIBEIAvWbNsvZy6nVPfu/8L0lMJvonVuUJMg+9mR7ahk6dO7FLguCDOvD1rfLFpQ1zB2rE=';

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

exports.handler = function (event, ignore, callback) {
    if (expectedSlackToken && commands) {
        // Container reuse, simply process the event with the key in memory
        return processEvent(event, callback);
    }

    var promises = [Promise.resolve()];

    if (!expectedSlackToken) {
        promises.push(
            kmsDecrypt(kmsEncryptedSlackToken)
                .then(function (result) {
                    expectedSlackToken = result;
                })
        );
    }

    if (!commands) {
        promises.push(
            kmsDecrypt(kmsEncryptedPagerDutyApiToken)
                .then(function (pagerDutyApiToken) {
                    var pagerDuty = new PagerDuty(pagerDutyApiToken);
                    commands = new Commands(pagerDuty, slack);
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
