'use strict';

module.exports = function Commands(pagerduty, slack) {

    function processNow(responseUrl) {
        const MAX_ESCALATION_LEVEL = 2;
        pagerduty.getOnCalls()
            .then(function (onCalls) {
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
                            until = `until ${onCall.end} (<${onCall.scheduleUrl}|${onCall.scheduleName}>)`;
                        }
                        return `• <${onCall.userUrl}|${onCall.userName}> - ${until}`;
                    }).join('\n');
                }

                return slack.respond(responseUrl, {
                    response_type: 'in_channel',
                    text: `Current PagerDuty on call roster:`,
                    attachments: Object.keys(byPolicyIdAndLevel).sort().map(function (key) {
                        // https://api.slack.com/docs/message-attachments
                        var entries = byPolicyIdAndLevel[key];
                        var first = entries[0];
                        return {
                            title: `${first.policyName} - Level ${first.escalationLevel}`,
                            title_link: first.policyUrl,
                            text: formatOnCalls(entries),
                        };
                    }),
                });

            })
            .catch(function (err) {
                console.error(err);
            });


        return Promise.resolve({
            response_type: 'in_channel',
        });
    }

    this.processCommand = function processCommand(params) {

        var commandText = params.text;
        var responseUrl = params.response_url;

        var match = /^now *$/.exec(commandText);
        if (match) {
            return processNow(responseUrl);
        }

        //TODO return usage help `${params.command} now`
        return Promise.reject("Unknown command");
    };

};
