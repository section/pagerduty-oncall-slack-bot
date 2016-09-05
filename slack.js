'use strict';

var rp = require('request-promise');

module.exports = function Slack(apiToken) {

    const SLACK_API_BASE_URL = 'https://slack.com/api';

    this.respond = function slackRespond(url, body) {
        // https://api.slack.com/slash-commands#responding_to_a_command
        return rp({
            method: 'POST',
            url: url,
            body: body,
            json: true
        });
    };

    this.getUserInfo = function slackGetUserInfo(userId) {
        // https://api.slack.com/methods/users.info
        var options = {
            method: 'GET',
            url: `${SLACK_API_BASE_URL}/users.info`,
            qs: {
                token: apiToken,
                user: userId,
            },
            json: true,
        };

        return rp(options).then(function (json) {
            if (!json.ok) {
                return Promise.reject(new Error(json.error));
            }

            var u = json.user;
            return {
                id: u.id,
                team_id: u.team_id,
                name: u.name,
                realName: u.real_name,
                tz: u.tz, // eg `Australia/Canberra`, ie "tz database" name
                timezoneLabel: u.tz_label, // eg `Australian Eastern Standard Time`
                timezoneOffsetSeconds: u.tz_offset, // eg `36000`, ie UTC offset in seconds
            };
        });
    };

    // TODO get all users timezones, and all users in channel to find the most common timezones

};
