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

## ⚠️ No SSH access is required for any of this

**The EC2 private key is not available.** It is not on the maintainer's machine,
and `EC2_SSH_KEY` in GitHub Actions secrets is write-only — GitHub does not allow
reading a secret back, so it cannot be recovered from there. An AWS EC2 key pair's
`.pem` is downloadable exactly once at creation time and cannot be re-downloaded.

Attempting SSH currently yields:

```
ubuntu@54.155.132.177: Permission denied (publickey).
```

(Note that's an *authentication* failure, not a network one — the TCP connection
to :22 succeeds from a developer IP. It's GitHub's runners that can't reach :22
at all, which is the separate problem this migration solves.)

This is fine: **every step below is done via the AWS Console.** Once the SSM agent
registers (Step 1), Session Manager provides a root shell in the browser with no
SSH key at all — which is also how Step 4 gets done. The lost key is a further
argument for this migration, not a blocker to it.

---

## Step 0 — Collect the two IDs you need

| Value | AWS Console | AWS CLI (if configured) |
|---|---|---|
| **Account ID** | Top-right account menu — the 12-digit number | `aws sts get-caller-identity --query Account --output text` |
| **Instance ID** | EC2 → Instances → select the instance → `i-…` | `aws ec2 describe-instances --filters "Name=ip-address,Values=54.155.132.177" --query 'Reservations[].Instances[].InstanceId' --output text` |
| **Region** | Top-right region selector (the IP `54.155.132.177` is an `eu-west-1` address) | `aws configure get region` |

> If SSH access is ever restored, all three are also available in one shot from
> the instance metadata service:
> ```bash
> TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
> curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/dynamic/instance-identity/document
> ```
> The two-step token exchange is required because AWS defaults to IMDSv2.

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

Or in the console: **Systems Manager → Fleet Manager** — the instance should appear
within ~1 minute of the role being attached.

If it never appears, the usual causes are (a) the instance profile didn't attach,
(b) the instance has no outbound internet route to the SSM endpoints (needs a NAT
gateway or public IP — this one has a public IP, so fine), or (c) the agent is
stopped. Rebooting the instance from the EC2 console restarts the agent and is the
easiest fix without shell access.

**This step is the gate for everything else** — once the instance shows up here,
you have browser shell access via Session Manager and no longer need SSH.

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

Instead authenticate the instance once, persistently.

1. Create a GitHub PAT with **`read:packages`** scope only.
2. Open a shell on the instance **without SSH**: EC2 → Instances → select it →
   **Connect** → **Session Manager** tab → **Connect**. (Requires Step 1 complete.)
3. In that browser shell, log in **as root**:

```bash
sudo -i                                                    # become root
echo '<PAT>' | docker login ghcr.io -u Etchinoo --password-stdin
cd /opt/hagez && docker compose pull api                   # verify it works
```

**Root specifically, not `ubuntu`.** Docker credentials are stored per-user in
`~/.docker/config.json`, and SSM Run Command executes as **root** — so a login
performed as `ubuntu` would leave CI unable to pull, failing with `denied` /
`unauthorized` even though a manual test as `ubuntu` succeeded. This is the most
likely thing to trip up the first CI deploy.

The credential persists across reboots, so the deploy payload needs no secrets.

## Step 5 — GitHub repo secrets

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/hagez-github-deploy` |
| `EC2_INSTANCE_ID` | `i-0abc123def4567890` |
| `AWS_REGION` | e.g. `eu-west-1` |

## Step 6 — Close the door, remove the dead secrets

Once a deploy has succeeded via SSM:

1. EC2 → Security Groups → **remove the inbound `:22` rule entirely.** There's no
   reason to keep it: the private key is gone, so nobody can authenticate over it
   anyway, and Session Manager is the break-glass path now.
2. Delete the `EC2_HOST` and `EC2_SSH_KEY` GitHub secrets — both are now unused,
   and `EC2_SSH_KEY` holds a key with no corresponding local copy.

**Emergency/manual deploy** (no SSH needed) — EC2 → Connect → Session Manager:

```bash
sudo -i
cd /opt/hagez && docker compose pull api && docker compose up -d --no-deps api
curl -fsS http://localhost/health
```

### Optional: restore key-based SSH later

Not required, but if you want it back, create a new key pair and attach the public
key via Session Manager:

```bash
sudo -i
echo '<new-public-key>' >> /home/ubuntu/.ssh/authorized_keys
```

…then re-add a `:22` inbound rule scoped to your own IP only (never `0.0.0.0/0`).

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
| Remote stderr shows `denied` / `unauthorized` on pull | Step 4 not done; the PAT lacks `read:packages` or expired; **or the `docker login` was done as `ubuntu` rather than `root`** — SSM runs as root and reads `/root/.docker/config.json`. |
| Status `Success` but the API is stale | Image tag didn't change — confirm the build job pushed `:latest` for this commit. |
