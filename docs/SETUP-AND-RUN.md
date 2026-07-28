# Setup and run

How I run the IT Ops Dashboard locally, and how I shipped the demo: **Vercel frontend**, **DigitalOcean backend**, HTTPS end-to-end.

For free Notion / Slack / Groq keys I used **[SETUP-NOTION-SLACK.md](./SETUP-NOTION-SLACK.md)**. Product overview and design notes stay in the root **[README.md](../README.md)**.

---

## Current production


| Piece           | Where                                                               |
| --------------- | ------------------------------------------------------------------- |
| Frontend        | [https://mtm-it-ops.vercel.app](https://mtm-it-ops.vercel.app)      |
| API             | [https://api.getapprovl.com](https://api.getapprovl.com/api/health) |
| Backend         | DigitalOcean droplet · Docker `db` + `api` + `worker` behind Apache |
| Repo on droplet | `/var/www/mtm-it-ops-dashboard`                                     |


I followed the steps below to get here.

---



## Architecture


| Piece             | Where            | Why                                                                                      |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| **web** (Next.js) | Vercel + domain  | Frontend. Calls the API via `NEXT_PUBLIC_API_BASE_URL` (baked in at **build** time).     |
| **api**           | Droplet · Docker | Express on `:8080` inside the container. Apache terminates TLS in front of it.           |
| **worker**        | Droplet · Docker | Polls Notion, calls the LLM, posts Slack alerts. Outbound only — no public callback URL. |
| **db**            | Droplet · Docker | Postgres + pgvector. Never exposed to the internet.                                      |


```
Browser → https → web (Vercel)
       → https → api.getapprovl.com
       → localhost → Docker API :18080 (or :8080)
       · worker → Notion / Slack
```

**Hard rule:** an HTTPS frontend must not call a plain HTTP API (mixed content). The backend needs TLS too — I used `https://api.getapprovl.com`.

Notion is polled, not webhooked. Slack is an outgoing webhook. The droplet needs no inbound path for either.

---



## Local (zero config)

Prerequisites: **Docker** with `docker compose`.

```bash
cp .env.example .env
docker compose up --build
```


| What       | URL                                                                  |
| ---------- | -------------------------------------------------------------------- |
| Dashboard  | [http://localhost:3000](http://localhost:3000)                       |
| API health | [http://localhost:8080/api/health](http://localhost:8080/api/health) |


With blank keys the stack boots on fixtures / mock LLM / Slack skipped. I fill keys in `.env` and recreate containers to go live one integration at a time.

---



## Production ship (Vercel + DigitalOcean + Apache)

I reused a droplet that already had **Apache + certbot** — I added one more vhost rather than standing up a new proxy. Domain: `getapprovl.com`.

### 1. Point the domain at DigitalOcean

I created an A record for the API subdomain (I kept DNS at Namecheap and pointed `api` at the droplet IP — moving nameservers to DigitalOcean is optional).


| Type | Hostname | Value               | TTL  |
| ---- | -------- | ------------------- | ---- |
| A    | `api`    | `<YOUR_DROPLET_IP>` | 3600 |


I waited until this returned the droplet IP before continuing:

```bash
dig @8.8.8.8 api.getapprovl.com +short
```



### 2. Clone and configure on the droplet

```bash
git clone <your-repo-url> && cd mtm-it-ops-dashboard
cp .env.example .env
# edit .env — see Env on the droplet below
```

I installed Docker from **distro packages**, not snap (snap Compose often cannot see files outside its confinement):

```bash
# If apt mirrors 404 on an EOL Ubuntu release, either upgrade to an LTS
# or temporarily point sources at old-releases.ubuntu.com, then:
apt update
apt install -y docker.io docker-compose-v2
systemctl enable --now docker
docker compose version
```



### 3. Keep Postgres private; bind the API to loopback

Compose’s default `5432:5432` / `8080:8080` publishes on `0.0.0.0`. Docker’s iptables bypasses `ufw`, so those ports stay reachable from the public IP even with the firewall “on”.

I created `docker-compose.override.yml` next to `docker-compose.yml`:

```yaml
services:
  api:
    # Host port 18080 if something else already owns :8080 on the droplet
    ports: !override
      - "127.0.0.1:18080:8080"

  db:
    ports: !reset []
```

Firewall — only SSH and Apache:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

I did **not** open `8080`, `18080`, or `5432`.

Then I brought up **backend only** (web is on Vercel):

```bash
docker compose up -d --build db api worker
docker compose ps
curl http://127.0.0.1:18080/api/health
```

What I wanted to see: `api` on `127.0.0.1:18080->8080/tcp` and `db` with no host publish (`5432/tcp` only).

### 4. Apache reverse proxy + Let's Encrypt

```bash
a2enmod proxy proxy_http headers ssl
systemctl reload apache2

cat > /etc/apache2/sites-available/api.getapprovl.com.conf <<'EOF'
<VirtualHost *:80>
    ServerName api.getapprovl.com

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:18080/
    ProxyPassReverse / http://127.0.0.1:18080/

    ErrorLog  ${APACHE_LOG_DIR}/api_error.log
    CustomLog ${APACHE_LOG_DIR}/api_access.log combined
</VirtualHost>
EOF

a2ensite api.getapprovl.com.conf
apache2ctl configtest
systemctl reload apache2

certbot --apache -d api.getapprovl.com
```

I verified from a browser and with:

```bash
curl https://api.getapprovl.com/api/health
```

JSON `ok`, no certificate warning. I did **not** wire Vercel until this passed.

If `curl` on Windows reports `SEC_E_UNTRUSTED_ROOT` / the browser shows `ERR_CERT_AUTHORITY_INVALID` while the droplet’s own `curl` and `openssl` look fine, I checked laptop DNS, antivirus HTTPS scanning, or IPv6 — the server cert was fine in my case.

### 5. Deploy the frontend on Vercel

1. Imported the repo.
2. Set **Root Directory** to `web`.
3. Added the environment variable (Production; Preview too if I use it):


| Name                       | Value                            |
| -------------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.getapprovl.com/api` |


1. Deployed. Changing this value requires a **fresh deploy** — Next.js inlines `NEXT_PUBLIC_`* at build time.

Optional on the droplet `.env` once I knew the Vercel URL:

```bash
CORS_ORIGIN=https://mtm-it-ops.vercel.app
```

If unset, the API defaults to `*` (fine for the demo).

### 6. Wire Notion / Slack / LLM

I followed **[SETUP-NOTION-SLACK.md](./SETUP-NOTION-SLACK.md)**, pasted keys into the droplet `.env`, then:

```bash
docker compose up -d --force-recreate api worker
curl https://api.getapprovl.com/api/health
```

---



## Env on the droplet

`/var/www/mtm-it-ops-dashboard/.env`. Every integration is optional; blank keys use fixtures / mock / skipped Slack.

```bash
# Optional once the frontend URL is known (default is *)
CORS_ORIGIN=https://mtm-it-ops.vercel.app

NOTION_API_KEY=...
NOTION_DATABASE_ID=...

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

LLM_API_KEY=gsk_...   # Groq default in .env.example

# Recommended on prod if I am about to wipe the DB volume anyway:
EMBEDDING_PROVIDER=local
RAG_MIN_SCORE=0.3
```

`.env.example` documents every knob. After edits:

```bash
docker compose up -d --force-recreate api worker
```

---



## Switching from fixtures → live (stale mock cards)



### Why this happens

The first `docker compose up` with blank keys syncs **fixtures** into Postgres (mock areas + mock summaries). The `pgdata` volume **persists** across restarts. After I paste real keys and recreate containers, Notion syncs **real** areas — but the old fixture rows are still there. Nothing prunes them. Result: fixture/mock cards sitting next to real Notion cards.

### Fix (order matters)

**Step 1 — confirm keys are actually live**

```bash
curl https://api.getapprovl.com/api/health
```

I want something like:

```text
notion: live    llm: live (or your provider)    slack: live
```

If any mode is still `fixtures` / `mock` / `disabled`, I fix the key first. A volume wipe while a key is blank just repopulates mock data.

**Step 2 — wipe the stale volume and rebuild clean**

Optionally I set semantic RAG **before** the reset so the fresh boot auto-seeds with MiniLM:

```bash
# in .env
EMBEDDING_PROVIDER=local
RAG_MIN_SCORE=0.3
```

Then:

```bash
docker compose down -v && docker compose up -d --build
```

`-v` drops the Postgres volume. That is safe here: the DB is a mirror of Notion (re-syncs on boot), plus the RAG corpus (auto-re-seeds) and regenerable logs/history. With live keys in place from the first boot after reset, only real Notion areas are written.

> I do **not** run `down -v` while a Notion/LLM key is still blank.

The same gotcha applies locally: fixtures → live on an existing volume needs a reset (or a future reconciliation prune).

---



## Go-live checklist

- [x] DNS resolves — `dig api.getapprovl.com +short` returns the droplet IP
- [x] Containers healthy — `docker compose ps` shows `db`, `api`, `worker` up; `web` absent on the droplet
- [x] Ports closed — `5432` and `8080` not reachable from outside; only `80` / `443` open
- [x] Backend TLS — `https://api.getapprovl.com/api/health` returns ok (no cert warning)
- [x] Frontend talks to backend — Vercel app loads area data over HTTPS
- [x] Health shows live integrations after keys are set
- [x] After fixtures→live, volume was reset so only real Notion cards remain
- [x] Sync now updates cards; AI summaries render
- [x] Status change into At Risk / Blocked posts to Slack

---



## Useful commands

```bash
# Status and logs
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 worker

# Health
curl http://127.0.0.1:18080/api/health
curl https://api.getapprovl.com/api/health

# Recreate after .env edits (keep volume)
docker compose up -d --force-recreate api worker

# Wipe DB and rebuild (only when health is already all-live)
docker compose down -v && docker compose up -d --build

# Re-seed RAG after changing EMBEDDING_PROVIDER on a non-empty volume
docker compose exec api npm run seed:rag
```

---



## Related docs


| Doc                                              | Contents                                             |
| ------------------------------------------------ | ---------------------------------------------------- |
| [README.md](../README.md)                        | Product overview, design, local quick start, testing |
| [SETUP-NOTION-SLACK.md](./SETUP-NOTION-SLACK.md) | Free Notion, Slack, Groq key walkthrough             |
| [database/dbdiagram.md](./database/dbdiagram.md) | Schema diagram                                       |


