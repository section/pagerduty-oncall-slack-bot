'use strict';

var AWS;
var qs = require('qs');
var Commands = require('./commands');
var Pagerduty = require('./pagerduty');
var slack = require('./slack');

var expectedSlackToken;
var pagerdutyApiToken = 'w_8PcNuhHa-y3xYdmc1x'; // webdemo

var pagerduty = new Pagerduty(pagerdutyApiToken);
var commands = new Commands(pagerduty, slack);

const kmsEncryptedToken = 'TODO';

exports.handler = function (event, ignore, callback) {
    if (expectedSlackToken) {
        // Container reuse, simply process the event with the key in memory
        processEvent(event, callback);
    } else if (kmsEncryptedToken && kmsEncryptedToken !== "<kmsEncryptedToken>") {
        var encryptedBuf = new Buffer(kmsEncryptedToken, 'base64');
        var cipherText = {CiphertextBlob: encryptedBuf};

        if (!AWS) {
            try {
                AWS = require('aws-sdk');
            } catch (err) {
                return callback(err);
            }
        }
        var kms = new AWS.KMS();
        kms.decrypt(cipherText, function (err, data) {
            if (err) {
                return callback(new Error('Decrypt error:' + err));
            } else {
                expectedSlackToken = data.Plaintext.toString('ascii');
                return processEvent(event, callback);
            }
        });
    } else {
        return callback(new Error('Token has not been set.'));
    }
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
