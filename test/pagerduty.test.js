'use strict';

var expect = require('chai').expect;

var PagerDuty = require('../pagerduty');

describe('pagerduty', function () {

    this.timeout(8000);
    const PAGERDUTY_WEBDEMO_TOKEN = 'w_8PcNuhHa-y3xYdmc1x';

    describe('getOnCalls', function () {

        it('should return more than the first page of results', function () {

            var pagerDuty = new PagerDuty(PAGERDUTY_WEBDEMO_TOKEN);

            var promise = pagerDuty.getOnCalls();
            return promise.then(function (onCalls) {
                expect(onCalls.length).at.least(26);
                expect(onCalls[0].policyId).ok;
            });

        });

    });

    describe('getEscalationPolicies', function () {

        it('should return policies', function () {

            var pagerDuty = new PagerDuty(PAGERDUTY_WEBDEMO_TOKEN);

            var promise = pagerDuty.getEscalationPolicies();
            return promise.then(function (policies) {
                expect(policies.length).at.least(1);
                expect(policies[0].policyId).ok;
                expect(policies[0].policyName).ok;
                expect(policies[0].policyUrl).ok;
                expect(policies[0]).property('policyDescription');
            });

        });

    });

});
