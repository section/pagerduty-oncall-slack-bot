'use strict';

var rp = require('request-promise');

module.exports.respond = function slackRespond(url, body) {
    // https://api.slack.com/slash-commands#responding_to_a_command
    return rp({
        method: 'POST',
        url: url,
        body: body,
        json: true
    });
};
