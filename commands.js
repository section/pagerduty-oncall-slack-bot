'use strict';

var moment = require('moment-timezone');

module.exports = function Commands(pagerduty, slack, recurseFunction) {

    const MAX_SLACK_ATTACHMENTS = 20;

    this.delayedNowResponse = function delayedNowResponse(commandArgument) {
        const MAX_ESCALATION_LEVEL = 2;

        var promises = [
            slack.getUserInfo(commandArgument.userId),
            pagerduty.getOnCalls(),
        ];

        Promise.all(promises)
            .then(function (results) {
                var user = results[0];
                var onCalls = results[1];

                var byPolicyIdAndLevel = {};
                onCalls
                    .filter(o => o.escalationLevel <= MAX_ESCALATION_LEVEL)
                    .forEach(function (onCall) {
                        // TODO 0-pad escalation level in keys for better sorting
                        var key = `${onCall.policyId}|${onCall.escalationLevel}`;
                        if (!byPolicyIdAndLevel.hasOwnProperty(key)) {
                            byPolicyIdAndLevel[key] = [];
                        }
                        byPolicyIdAndLevel[key].push(onCall);
                    });

                function formatOnCalls(onCalls) {
                    // TODO escape control sequences (ie `&`, `<`, `>`, maybe `|`)
                    return onCalls.map(function (onCall) {
                        var until = 'indefinitely';
                        if (onCall.end && onCall.scheduleName && onCall.scheduleUrl) {
                            var end = moment(onCall.end).tz(user.tz).format('h:mma ddd Do MMM');
                            until = `until ${end} (<${onCall.scheduleUrl}|${onCall.scheduleName}>)`;
                        }
                        return `• <${onCall.userUrl}|${onCall.userName}> - ${until}`;
                    }).join('\n');
                }

                var keys = Object.keys(byPolicyIdAndLevel).sort();
                var truncatedPolicyLevelCount = 0;
                if (keys.length > MAX_SLACK_ATTACHMENTS) {
                    truncatedPolicyLevelCount = keys.length - MAX_SLACK_ATTACHMENTS - 1;
                    keys.slice(0, MAX_SLACK_ATTACHMENTS - 1);
                }

                var attachments = keys.map(function (key) {
                    // https://api.slack.com/docs/message-attachments
                    var entries = byPolicyIdAndLevel[key];
                    var first = entries[0];
                    return {
                        title: `${first.policyName} - Level ${first.escalationLevel}`,
                        title_link: first.policyUrl,
                        text: formatOnCalls(entries),
                    };
                });

                if (truncatedPolicyLevelCount) {
                    attachments.push({
                        title: 'More...',
                        text: `${truncatedPolicyLevelCount} more policy-level combinations were omitted.`
                    });
                }

                var timezone = moment.tz(user.tz).format('Z');
                return slack.respond(commandArgument.responseUrl, {
                    response_type: 'in_channel',
                    text: `Current PagerDuty on call roster, using <@${user.id}>'s time zone (${timezone}):`,
                    attachments: attachments,
                });

            })
            .catch(function (err) {
                console.error(err);
            });
    };

    this.delayedPoliciesResponse = function delayedPoliciesResponse(commandArgument) {
        pagerduty.getEscalationPolicies()
            .then(function (policies) {

                if (policies.length > MAX_SLACK_ATTACHMENTS) {
                    var truncatedPolicyCount = policies.length - MAX_SLACK_ATTACHMENTS - 1;
                    policies = policies.slice(0, MAX_SLACK_ATTACHMENTS - 1);
                    policies.push({
                        policyName: 'More...',
                        policyDescription: `${truncatedPolicyCount} more escalation policies were omitted.`,
                    });
                }

                return slack.respond(commandArgument.responseUrl, {
                    response_type: 'ephemeral',
                    text: 'PagerDuty escalation policies:',
                    attachments: policies.map(function (policy) {
                        var mrkdwnIn = !policy.policyDescription ? ['text'] : undefined;
                        return {
                            title: policy.policyName,
                            title_link: policy.policyUrl,
                            text: policy.policyDescription || '_no description_',
                            mrkdwn_in: mrkdwnIn,
                        };
                    }),
                });

            })
            .catch(function (err) {
                console.error(err);
            });
    };

    function processNow(responseUrl, userId) {

        recurseFunction('delayedNowResponse', {
            responseUrl: responseUrl,
            userId: userId,
        }).catch(function (err) {
            console.error(err);
        });

        return Promise.resolve({
            response_type: 'in_channel',
        });
    }

    function processPolicies(responseUrl) {

        recurseFunction('delayedPoliciesResponse', {
            responseUrl: responseUrl,
        }).catch(function (err) {
            console.error(err);
        });

        return Promise.resolve({
            response_type: 'ephemeral',
            text: "Retrieving escalation policies...",
        });

    }

    this.processCommand = function processCommand(params) {

        var commandText = params.text;
        var responseUrl = params.response_url;
        var userId = params.user_id;
        var match;

        match = /^now *$/.exec(commandText);
        if (match) {
            // TODO filter by policy
            return processNow(responseUrl, userId);
        }

        match = /^policies *$/.exec(commandText);
        if (match) {
            return processPolicies(responseUrl);
        }

        return Promise.resolve({
            response_type: 'ephemeral',
            text: [
                'Usage:',
                `• \`${params.command} now\` - Post the current on call roster to this channel.`,
                `• \`${params.command} policies\` - Privately list the escalation policies.`,
            ].join('\n'),
        });
    };

};
