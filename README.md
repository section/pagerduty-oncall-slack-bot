# PagerDuty OnCall Slack bot

## Local development

1. `vagrant up`
1. `vagrant ssh`
1. `cd /vagrant`
1. `npm install`
1. `npm test`

## Deploying

Follow these steps to configure the slash command in Slack:

1. Navigate to https://<your-team-domain>.slack.com/services/new
1. Search for and select "Slash Commands".
1. Enter a name for your command and click "Add Slash Command Integration".
1. Copy the token string from the integration settings and use it in the next section.
1. After you complete the deployment to AWS, enter the provided API endpoint URL in the URL field.

Follow these steps to encrypt your Slack token for use in this function:

1. Create a KMS key - http://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html.
1. Give your function's role the permission for the kms:Decrypt action.
1. Encrypt the Slack token using the AWS CLI: `$ aws kms encrypt --region <region> --key-id alias/<KMS key name> --plaintext "<SLACK_TOKEN>"`
1. Copy the base-64 encoded, encrypted key (CiphertextBlob) to the relevant `kmsEncyptedSlackToken` configuration key value in `index.js`.
1. Obtain a read-only PagerDuty API V2 key - https://support.pagerduty.com/hc/en-us/articles/202829310-Generating-an-API-Key
1. Encrypt the PagerDuty API key using the AWS CLI: `$ aws kms encrypt --region <region> --key-id alias/<KMS key name> --plaintext "<PAGERDUTY_KEY>"`
1. Copy the base-64 encoded, encrypted key (CiphertextBlob) to the relevate `kmsEncryptedPagerDutyApiToken` configuration key value in `index.js`.

Example role permission:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "<your KMS key ARN>"
      ]
    }
  ]
}
```

Follow these steps to deploy the AWS Lambda function:

1. `aws configure`
1. `serverless deploy`
1. Update the URL for your Slack slash command with the invocation URL for the created API resource in the prod stage.
1. `serverless invoke --function slack --path event.json`

## Todo

* time zone support
* allow filtering by policy
* allow filtering by escalation level
* command to list on call for a time other than now (needs time zone support)
