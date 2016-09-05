'use strict';

var expect = require('chai').expect;

var Slack = require('../slack');

describe('slack', function () {

    this.timeout(8000);
    const SLACK_API_TOKEN = '_TODO_';

    describe('getUserInfo', function () {

        it('should reject unknown user ids', function () {

            var slack = new Slack(SLACK_API_TOKEN);

            var promise = slack.getUserInfo('_NOBODY_');
            return promise.then(function () {
                return Promise.reject(new Error('unexpected success'));
            }, function (err) {
                expect(err).ok;
                return Promise.resolve();
            });

        });

        it('should return a user with timezone properties', function () {

            var slack = new Slack(SLACK_API_TOKEN);

            var promise = slack.getUserInfo('U27766RHC');
            return promise.then(function (user) {
                expect(user.realName).ok;
                expect(user.tz).ok;
                expect(user.timezoneLabel).ok;
                expect(user.timezoneOffsetSeconds).is.a('Number');
            });

        });

    });

});
