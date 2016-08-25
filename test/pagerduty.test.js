'use strict';

var expect = require('chai').expect;

var PagerDuty = require('../pagerduty');

describe('pagerduty', function () {

    this.timeout(8000);
    const PAGERDUTY_WEBDEMO_TOKEN = 'w_8PcNuhHa-y3xYdmc1x';

    describe('getOnCalls', function () {

        it('should return more than the first page of results', function () {

            var pagerduty = new PagerDuty(PAGERDUTY_WEBDEMO_TOKEN);

            var promise = pagerduty.getOnCalls();
            return promise.then(function (onCalls) {
                expect(onCalls.length).at.least(26);
                expect(onCalls[0].policyId).ok;
            });

        });

    });

});
