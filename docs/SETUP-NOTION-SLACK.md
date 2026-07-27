# Setup: Notion, Slack, Groq, Docker

Everything here is free and needs no credit card. Budget ~25 minutes.

Work top to bottom. Each section ends with **a value to save** — paste them all into a scratch note,
and at the end they go into your `.env` file.

| # | What | Value you'll end up with | Time |
|---|---|---|---|
| 1 | Notion integration | `NOTION_API_KEY` | 3 min |
| 2 | Notion database | `NOTION_DATABASE_ID` | 10 min |
| 3 | Slack webhook | `SLACK_WEBHOOK_URL` | 5 min |
| 4 | Groq API key | `LLM_API_KEY` | 2 min |
| 5 | Docker Desktop | *(installed)* | 10 min, mostly unattended |

---

## 1. Notion integration → `NOTION_API_KEY`

1. Go to **https://www.notion.so/my-integrations**  (sign in / create a free account first).
2. Click **New integration**.
3. Fill in:
   - **Name:** `IT Ops Dashboard`
   - **Associated workspace:** your personal workspace
   - **Type:** Internal
4. Click **Save**.
5. On the next screen find **Internal Integration Secret** and click **Show** → **Copy**.

> **Save this** as `NOTION_API_KEY`. It starts with `ntn_` (older ones start with `secret_`).

Leave this tab open — you'll come back in step 2.6.

---

## 2. Notion database → `NOTION_DATABASE_ID`

### 2.1 Create it as a full-page database

In Notion, in your sidebar click **+ Add a page**. Title it **IT Ops Areas**.
Then on the empty page type `/database` and choose **Database - Full page**.

> It must be **Full page**, not Inline. A full-page database puts its own ID in the URL, which is
> what you need in step 2.5. Inline databases put the *parent page's* ID there instead, and the API
> will return a 404.

### 2.2 Create the properties

Notion gives you a `Name` (title) property and some defaults. Delete any default properties you
didn't create, then add these so the table reads **exactly**:

| Property name | Type | Options to add |
|---|---|---|
| `Name` | Title | *(already exists)* |
| `Status` | **Select** | `On Track`, `At Risk`, `Blocked`, `Done` |
| `Owner` | **Text** | — |
| `Category` | **Select** | `Infra`, `Security`, `Support`, `Network` |
| `Priority` | **Select** | `P0`, `P1`, `P2` |
| `Notes` | **Text** | — |
| `Blockers` | **Text** | — |

Two things that will bite you if you skip them:

- **`Status` must be type `Select`, not Notion's built-in `Status` type.** They look identical in the
  table but return different shapes from the API.
- **Names are case-sensitive** and must match exactly, including the space in `On Track`.

You don't need a "last updated" property — Notion tracks `last_edited_time` on every page
automatically and the app reads that.

### 2.3 Add the 8 seed rows

Type these in. `Blockers` is intentionally empty for the healthy ones.

**1. Identity & Access Management**
- Status: `On Track` · Owner: `Priya Raman` · Category: `Security` · Priority: `P1`
- Notes: `SSO rollout has reached 60% of staff. Okta tenant migration is on schedule for the 12th. Pilot group reported no auth failures this week.`
- Blockers: *(empty)*

**2. Network Infrastructure**
- Status: `On Track` · Owner: `Daniel Okafor` · Category: `Network` · Priority: `P1`
- Notes: `Core switch refresh complete at 7 of 9 sites. Remaining two are scheduled for the next maintenance window. No unplanned outages in 30 days.`
- Blockers: *(empty)*

**3. Endpoint Management**
- Status: `On Track` · Owner: `Sana Iqbal` · Category: `Infra` · Priority: `P2`
- Notes: `Intune enrollment at 94% of managed devices. Remaining 6% are contractor laptops pending hardware refresh.`
- Blockers: *(empty)*

**4. Backup & Disaster Recovery**
- Status: `Blocked` · Owner: `Marcus Webb` · Category: `Infra` · Priority: `P0`
- Notes: `Quarterly restore test failed twice against the tape library. Firmware level is two releases behind and the vendor will not support a restore until it is upgraded.`
- Blockers: `Vendor RMA for the tape controller has been open 9 days with no ETA. Cannot certify DR readiness until resolved.`

**5. Service Desk Operations**
- Status: `On Track` · Owner: `Aisha Kone` · Category: `Support` · Priority: `P2`
- Notes: `Ticket backlog down 31% month over month. First-response SLA met on 96% of P2 tickets. Two new agents completed onboarding.`
- Blockers: *(empty)*

**6. VPN & Remote Access**
- Status: `At Risk` · Owner: `Daniel Okafor` · Category: `Network` · Priority: `P2`
- Notes: `Concentrator running at 88% of licensed capacity during peak hours. Current headcount plan adds 40 users next month, which exceeds available headroom.`
- Blockers: `Budget approval for additional concentrator licenses is pending with Finance since the 14th.`

**7. Patch & Vulnerability Management**
- Status: `At Risk` · Owner: `Priya Raman` · Category: `Security` · Priority: `P1`
- Notes: `12 critical CVEs are past the 30-day remediation SLA, all on legacy application servers. Workstation and cloud patching are both within SLA.`
- Blockers: `Change freeze in effect until quarter end blocks remediation on the affected legacy servers.`

**8. Asset Inventory & Licensing**
- Status: `Done` · Owner: `Sana Iqbal` · Category: `Support` · Priority: `P2`
- Notes: `Annual reconciliation complete. 143 unused licenses reclaimed and returned to the pool, saving roughly 18k annually. Records match procurement.`
- Blockers: *(empty)*

### 2.4 ⚠️ Share the database with your integration

**This is the step everyone misses.** Without it, every API call returns 404.

On the database page, click the **`•••`** menu (top right) → **Connections** → **Connect to** →
pick **IT Ops Dashboard**. Confirm.

*(In some Notion versions this reads `Add connections` instead of `Connections`.)*

To verify it worked, reopen the **`•••`** menu — you should see **IT Ops Dashboard** listed under
Connections.

### 2.5 Get the database ID

Click **Share** → **Copy link** (or just copy the URL from your browser). It looks like:

```
https://www.notion.so/myworkspace/1f2e3d4c5b6a7890abcdef1234567890?v=abcdef...
                                  └────────── this is the ID ──────────┘
```

The database ID is the **32-character hex string** after the last `/` and before the `?`.

> **Save this** as `NOTION_DATABASE_ID`. Hyphens are optional — the app accepts either form.

---

## 3. Slack webhook → `SLACK_WEBHOOK_URL`

If you don't have a Slack workspace, create a free one at **https://slack.com/get-started** first.
Make a channel called `#it-ops-alerts`.

1. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**.
2. **App Name:** `IT Ops Dashboard` · pick your workspace → **Create App**.
3. In the left sidebar click **Incoming Webhooks**.
4. Toggle **Activate Incoming Webhooks** to **On**.
5. Scroll down → **Add New Webhook to Workspace**.
6. Choose **#it-ops-alerts** → **Allow**.
7. Copy the **Webhook URL** that appears.

> **Save this** as `SLACK_WEBHOOK_URL`. It looks like
> `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`.

**Treat this like a password** — anyone with the URL can post to your channel. It goes in `.env`,
which is gitignored, and never in a commit.

Quick sanity check (optional) — this should post "hello" to the channel:

```bash
curl -X POST -H 'Content-type: application/json' --data '{"text":"hello"}' YOUR_WEBHOOK_URL
```

---

## 4. Groq API key → `LLM_API_KEY`

Free, no credit card, 30 requests/minute — plenty for this.

1. Go to **https://console.groq.com** and sign in with Google or GitHub.
2. Left sidebar → **API Keys** → **Create API Key**.
3. Name it `it-ops-dashboard` → **Submit** → copy the key.

> **Save this** as `LLM_API_KEY`. It starts with `gsk_`. Groq shows it **once** — copy it now.

The app is provider-agnostic: swapping to a real OpenAI or Anthropic key later is three lines in
`.env`, no code change. `.env.example` will ship paste-ready blocks for all three.

---

## 5. Docker Desktop

1. Download from **https://docs.docker.com/desktop/setup/install/windows-install/**
2. Run the installer, keep **"Use WSL 2 instead of Hyper-V"** checked.
3. Reboot when prompted.
4. Launch Docker Desktop and wait for the whale icon to stop animating.
5. Verify in PowerShell:

```bash
docker --version && docker compose version
```

Both commands should print a version. If `docker` isn't recognized, fully quit and relaunch Docker
Desktop, then open a **new** terminal.

---

## Done — what you should have

```
NOTION_API_KEY=ntn_...
NOTION_DATABASE_ID=1f2e3d4c5b6a7890abcdef1234567890
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
LLM_API_KEY=gsk_...
```

Hold onto these. When the build reaches the first runnable checkpoint you'll copy `.env.example` to
`.env` and paste them in.

**None of these are needed to run the project.** With an empty `.env` the app boots on bundled
fixtures with a deterministic mock summarizer and alerting disabled — that's the path a reviewer
takes. Real keys are what make the *demo* real.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Notion API returns `404 object_not_found` | Database not shared with the integration | Redo step 2.4 |
| Notion API returns `401 unauthorized` | Wrong or truncated token | Re-copy from my-integrations |
| Database ID looks too short/long | Copied a page ID, or the database is Inline | Make it a **Full page** database (step 2.1) |
| `Status` values come back empty | Used Notion's built-in `Status` type | Change the property to type **Select** |
| Slack returns `invalid_payload` | Webhook URL copied with trailing whitespace | Re-copy, check for a trailing space |
| `docker` not recognized after install | Terminal opened before install finished | Open a new terminal; relaunch Docker Desktop |
