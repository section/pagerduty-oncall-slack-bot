'use strict';

var moment = require('moment-timezone');

module.exports = function Commands(pagerduty, slack, recurseFunction) {

    const TIME_PARSE_FORMATS = ['HH:mm', 'h:mma', 'ha'];
    const DATE_PARSE_FORMATS = ['MMM Do', 'MMM D', 'Do MMM', 'D MMM'];
    const MAX_SLACK_ATTACHMENTS = 20;
    const MAX_ESCALATION_LEVEL = 2;

    function sendOnCallsResponse(user, onCalls, responseUrl, atMoment) {

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

        var messageText = 'Current PagerDuty on call roster';
        if (atMoment) {
            messageText = 'PagerDuty on call roster as at ' + atMoment.format('h:mma ddd Do MMM');
        }
        messageText = `${messageText}, using <@${user.id}>'s time zone (${timezone}):`;

        return slack.respond(responseUrl, {
            response_type: 'in_channel',
            text: messageText,
            attachments: attachments,
        });

    }

    this.delayedNowResponse = function delayedNowResponse(commandArgument) {

        var promises = [
            slack.getUserInfo(commandArgument.userId),
            pagerduty.getOnCalls(),
        ];

        Promise.all(promises)
            .then(function (results) {
                var user = results[0];
                var onCalls = results[1];

                return sendOnCallsResponse(user, onCalls, commandArgument.responseUrl);
            })
            .catch(function (err) {
                console.error(err);
            });
    };

    this.delayedAtResponse = function delayedAtResponse(commandArgument) {

        slack.getUserInfo(commandArgument.userId)
            .then(function (user) {
                var time = moment.tz(commandArgument.timeText, TIME_PARSE_FORMATS, user.tz);

                var now = moment.tz(user.tz);
                var date = now.clone();
                if (commandArgument.dateText) {
                    date = moment.tz(commandArgument.dateText, DATE_PARSE_FORMATS, user.tz);
                }
                date.hour(time.hour());
                date.minute(time.minute());
                if (date.isBefore(now)) {
                    date.add(1, 'year');
                }

                pagerduty.getOnCalls(date.format())
                    .then(function (onCalls) {
                        return sendOnCallsResponse(user, onCalls, commandArgument.responseUrl, date);
                    })
                    .catch(function (err) {
                        console.error(err);
                    });
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

    function processAt(paramText, responseUrl, userId) {

        function usage() {
            return Promise.resolve({
                response_type: 'ephemeral',
                text: [
                    'Example usages of `at`:',
                    '• `at 9pm`',
                    '• `at 11:30am Sep 15`',
                    '• `at 08:00 Oct 3rd`',
                    '• `at 14:30 11th Apr`',
                    '• `at 22:00 22 Jan`',
                ].join('\n'),
            });
        }

        var match = /^([^ ]+) *(.*)/.exec(paramText);
        if (!match) {
            return usage();
        }

        var timeText = match[1];
        var dateText = match[2];

        var time = moment(timeText, TIME_PARSE_FORMATS, true);
        if (!time.isValid()) {
            return usage();
        }

        if (dateText) {
            var date = moment(dateText, DATE_PARSE_FORMATS);
            if (!date.isValid()) {
                return usage();
            }
        }

        recurseFunction('delayedAtResponse', {
            timeText: timeText,
            dateText: dateText,
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

        match = /^at +(.+)$/.exec(commandText);
        if (match) {
            return processAt(match[1], responseUrl, userId);
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
                `• \`${params.command} at <time> <date>\` - Post the on call roster for the specified time to this channel.`,
                `• \`${params.command} policies\` - Privately list the escalation policies.`,
            ].join('\n'),
        });
    };

};
