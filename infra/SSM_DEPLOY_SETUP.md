# SSM Deploy Setup

One-time AWS setup so `deploy-api.yml` can deploy without SSH.

## Why this exists

The deploy previously used `appleboy/ssh-action` from a GitHub-hosted runner. That
requires the EC2 security group to allow inbound `:22` from GitHub's runner IPs.
Those ranges rotate continuously and currently number **~7,300 CIDRs** — far past
the **1,000-rule hard cap** on an AWS security group. Allowlisting them is not
merely tedious, it's impossible, which is why the deploy started failing with:

```
dial tcp <host>:22: i/o timeout
```

AWS SSM inverts the connection direction: the SSM agent on the instance polls AWS
*outbound*, and GitHub calls the SSM API. **Inbound `:22` can stay closed to the
internet permanently.**

---

## Step 0 — Collect the two IDs you need

You have working SSH from your own machine, so the quickest way to get both the
**instance ID** and **account ID** at once is straight off the instance's metadata
service (IMDSv2):

```bash
ssh ubuntu@54.155.132.177 'TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60"); curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/dynamic/instance-identity/document'
```

That returns JSON containing everything needed:

```json
{
  "accountId": "123456789012",
  "instanceId": "i-0abc123def4567890",
  "region": "eu-west-1",
  ...
}
```

Alternatives if you prefer the console or have the AWS CLI:

| Value | AWS Console | AWS CLI |
|---|---|---|
| **Account ID** | Top-right account menu — the 12-digit number | `aws sts get-caller-identity --query Account --output text` |
| **Instance ID** | EC2 → Instances → your instance (`i-…`) | `aws ec2 describe-instances --filters "Name=ip-address,Values=54.155.132.177" --query 'Reservations[].Instances[].InstanceId' --output text` |
| **Region** | Top-right region selector | `aws configure get region` |

---

## Step 1 — Let the instance talk to SSM

The SSM agent ships preinstalled on Ubuntu AMIs; it only lacks IAM permission.

1. IAM → Roles → **Create role** → trusted entity **AWS service** → **EC2**
2. Attach the managed policy **`AmazonSSMManagedInstanceCore`**
3. Name it e.g. `hagez-ec2-ssm-role`
4. EC2 → Instances → select the instance → **Actions → Security → Modify IAM role** → attach that role

Verify it registered (may take ~1 min):

```bash
aws ssm describe-instance-information \
  --query "InstanceInformationList[].{Id:InstanceId,Ping:PingStatus}" --output table
```

Expect your instance with `PingStatus: Online`. If it stays absent, restart the agent:

```bash
ssh ubuntu@54.155.132.177 'sudo systemctl restart amazon-ssm-agent && sudo systemctl status amazon-ssm-agent --no-pager'
```

## Step 2 — GitHub OIDC provider

Lets GitHub Actions assume an AWS role with **short-lived** tokens — no static
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` stored in GitHub.

IAM → Identity providers → **Add provider** → **OpenID Connect**:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

## Step 3 — Deploy role

IAM → Roles → **Create role** → **Web identity** → the provider above.
Name it `hagez-github-deploy`.

**Trust policy** (replace `<ACCOUNT_ID>`) — scoped so only this repo can assume it:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:Etchinoo/Hagez:*" }
    }
  }]
}
```

> Tighten `sub` to `repo:Etchinoo/Hagez:ref:refs/heads/main` if you want to
> restrict assumption to `main` only. Note the deploy job also sits behind the
> `Production` environment approval gate, which is a second independent control.

**Permissions policy** (replace `<ACCOUNT_ID>`, `<REGION>`, `<INSTANCE_ID>`) —
scoped to one instance and one SSM document:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:<REGION>:<ACCOUNT_ID>:instance/<INSTANCE_ID>",
        "arn:aws:ssm:<REGION>::document/AWS-RunShellScript"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
      "Resource": "*"
    }
  ]
}
```

## Step 4 — Persistent GHCR login on the instance

The old script passed `GITHUB_TOKEN` into the remote shell. We deliberately do
**not** do that with SSM: command parameters are retained in SSM command history
and CloudTrail, so a credential in the payload would be recorded.

Instead authenticate the instance once, persistently. Create a GitHub PAT with
**`read:packages`** scope only, then:

```bash
ssh ubuntu@54.155.132.177
echo '<PAT>' | docker login ghcr.io -u Etchinoo --password-stdin
```

This writes `~/.docker/config.json`, which survives reboots — so the deploy
payload needs no secrets at all.

Verify the pull path works before relying on CI:

```bash
ssh ubuntu@54.155.132.177 'cd /opt/hagez && docker compose pull api'
```

## Step 5 — GitHub repo secrets

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/hagez-github-deploy` |
| `EC2_INSTANCE_ID` | `i-0abc123def4567890` |
| `AWS_REGION` | e.g. `eu-west-1` |

## Step 6 — Close the door, remove the old keys

Once a deploy has succeeded via SSM:

1. EC2 → Security Groups → **remove the inbound `:22` rule** (or narrow it to your
   own IP for break-glass access).
2. Delete the now-unused `EC2_HOST` and `EC2_SSH_KEY` GitHub secrets.

If you keep a break-glass SSH rule, the manual deploy path remains:

```bash
ssh ubuntu@54.155.132.177 'cd /opt/hagez && docker compose pull api && docker compose up -d --no-deps api'
```

---

## Verifying

Trigger `Deploy API` manually (Actions → Deploy API → Run workflow), approve the
`Production` gate, and confirm the job prints `SSM status: Success` along with the
remote stdout ending in `Health check passed`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `InvalidInstanceId` | Instance not registered with SSM — Step 1 incomplete, or agent offline. Re-check `describe-instance-information`. |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Trust policy `sub`/`aud` mismatch, or the job is missing `permissions: id-token: write`. |
| `AccessDeniedException` on `ssm:SendCommand` | Permissions policy ARNs don't match the real region/account/instance. |
| Remote stderr shows `denied` / `unauthorized` on pull | Step 4 not done, or the PAT lacks `read:packages` / has expired. |
| Status `Success` but the API is stale | Image tag didn't change — confirm the build job pushed `:latest` for this commit. |
