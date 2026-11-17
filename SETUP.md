# Running Piraso on your own computer

> Piraso was previously called Porkshop. The GitHub repository, the `PorkShop` folder and the `porkshop-db` database keep the old name; that's expected.

This guide takes you from a brand-new laptop to Piraso running at **http://localhost:3000**. Follow the parts in order and type each command exactly as shown.

- **Time needed:** about 30–45 minutes the first time, mostly waiting for downloads. After that, starting Piraso takes under a minute.
- **Works on:** Windows 10/11 (64-bit) and macOS 12 or newer.
- **You'll need:** 8 GB of RAM (16 GB is more comfortable), about 5 GB of free disk space, an internet connection during setup, and permission to install programs.

> Every command in this guide was tested on a fresh copy of the project downloaded from GitHub.

---

## Contents

1. [Install the tools (one time)](#part-1--install-the-tools-one-time)
2. [Download the project](#part-2--download-the-project)
3. [Create the settings file](#part-3--create-the-settings-file-env)
4. [Start the database](#part-4--start-the-database)
5. [Install the app's packages](#part-5--install-the-apps-packages)
6. [Create the tables and sample data](#part-6--create-the-tables-and-sample-data)
7. [Build and start Piraso](#part-7--build-and-start-piraso)
8. [Sign in and set up your shop](#part-8--sign-in-and-set-up-your-shop)
- [Everyday use](#everyday-use-starting-and-stopping)
- [Opening Piraso on other devices (demos and panelists)](#opening-piraso-on-other-devices-demos-and-panelists)
- [Getting updates](#getting-updates)
- [Backing up and restoring your data](#backing-up-and-restoring-your-data)
- [Troubleshooting](#troubleshooting)
- [Removing Piraso](#removing-piraso)

---

## Opening a terminal

Most steps are commands you type into a **terminal**:

- **Windows:** press the Start button, type **PowerShell**, and open **Windows PowerShell**.
- **macOS:** press `⌘ + Space`, type **Terminal**, and press Enter.

Type (or paste) a command, then press **Enter**. Wait until the command finishes before typing the next one.

---

## Part 1 — Install the tools (one time)

Piraso needs three free programs: **Git** downloads the code, **Node.js** runs the app, and **Docker Desktop** runs the database.

### 1.1 Git

- **Windows:** download from https://git-scm.com/download/win and run the installer. Keep every default option and click **Next** until it finishes.
- **macOS:** open Terminal and run `xcode-select --install`, then click **Install** in the window that appears.

### 1.2 Node.js 24 (LTS)

Go to https://nodejs.org/en/download and download **version 24 (LTS)**. If the page offers a newer version by default, use its version menu to choose **v24**. Piraso was tested with Node.js 24; version 22.12 or newer also works.

- **Windows:** run the `.msi` installer and keep the defaults. You can leave *"Automatically install the necessary tools"* unticked.
- **macOS:** run the `.pkg` installer.

### 1.3 Docker Desktop

Download from https://www.docker.com/products/docker-desktop/ and install it.

- **Windows:** keep **"Use WSL 2"** ticked during installation, then restart your computer when asked. If Docker later says WSL needs installing or updating, open **PowerShell as Administrator** (right-click → *Run as administrator*), run `wsl --install` (or `wsl --update`), and restart again.
- **macOS:** choose the download for your Mac's chip (**Apple silicon** or **Intel**; check  → *About This Mac*).

Open **Docker Desktop**, accept the terms (signing in is optional; you can skip it), and wait until the bottom-left corner shows **Engine running**.

> Docker Desktop is free for personal use, education and small businesses. Larger companies (more than 250 employees or more than US$10 million in yearly revenue) need a paid Docker subscription.

### 1.4 Windows only: allow PowerShell to run `npm`

Windows blocks the scripts that `npm` uses by default. Run this once in PowerShell, and type **Y** then Enter if it asks to confirm:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 1.5 Check that everything is installed

**Close the terminal and open a new one** so it picks up the new programs. Then run each line:

```bash
git --version
node -v
npm -v
docker --version
docker compose version
```

Each line should print a version number, for example:

```
git version 2.52.0
v24.13.1
11.8.0
Docker version 29.9.2
Docker Compose version v5.6.1
```

Your numbers may be slightly different. `node -v` must start with **v24** (or be **v22.12** or newer). If a command prints *"not recognized"* or *"command not found"*, see [Troubleshooting](#troubleshooting).

---

## Part 2 — Download the project

Create a **Projects** folder in your home folder and download Piraso into it:

```bash
mkdir ~/Projects
cd ~/Projects
git clone https://github.com/KurtSalut29/PorkShop.git
cd PorkShop
```

When it's done, the terminal is inside the `PorkShop` folder. **Run every remaining command from this folder.**

> Don't put the project inside a OneDrive, Google Drive, Dropbox or iCloud folder. Syncing tens of thousands of small files slows the computer down and can break the install.
>
> If `mkdir` says the folder already exists, that's fine. Continue with the next line.

---

## Part 3 — Create the settings file (`.env`)

Piraso reads its settings from a file named `.env`. **Create it before Part 5:** the package install in Part 5 fails without it.

**1. Copy the example file:**

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

macOS:

```bash
cp .env.example .env
```

**2. Generate a secret key** (it protects your users' sign-ins):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

It prints a random line such as `Fm4Z9RPs0uY3...=`. Select and copy it.

**3. Put the key in the file.** Open `.env`:

- Windows: `notepad .env`
- macOS: `open -e .env`

Find this line:

```
BETTER_AUTH_SECRET="replace-with-a-long-random-string"
```

Replace `replace-with-a-long-random-string` with the key you copied. Keep the quotation marks:

```
BETTER_AUTH_SECRET="Fm4Z9RPs0uY3...="
```

Save the file and close the editor. Leave the other lines as they are:

| Setting | What it is |
|---|---|
| `DATABASE_URL` | Where the database is. Matches Part 4; don't change it. |
| `BETTER_AUTH_SECRET` | The key you just pasted. Keep it private, and don't change it later, or everyone will be signed out. |
| `BETTER_AUTH_URL` | The address you open Piraso at: `http://localhost:3000`. |
| `NEXT_PUBLIC_APP_URL` | Same address as above. |

---

## Part 4 — Start the database

Make sure **Docker Desktop is open** and shows **Engine running**, then run:

```bash
docker compose up -d
```

The first time, this downloads the PostgreSQL database (about 100 MB). It ends with:

```
 Container porkshop-db Started
```

Check that the database is ready:

```bash
docker ps
```

Look for `porkshop-db` with **(healthy)** in its status. If it says **(health: starting)**, wait a few seconds and run `docker ps` again.

---

## Part 5 — Install the app's packages

```bash
npm install
```

This takes about 2–5 minutes. It finishes with a line like `added … packages` and returns you to the prompt.

- Messages about **"vulnerabilities"**, **"deprecated"** or **"funding"** are normal. You can ignore them.
- **Don't run `npm audit fix --force`.** It upgrades packages to versions Piraso hasn't been tested with and can break it.
- If you see `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`, the `.env` file is missing. Do Part 3, then run `npm install` again.

---

## Part 6 — Create the tables and sample data

**1. Create the database tables:**

```bash
npx prisma migrate deploy
```

It should end with:

```
All migrations have been successfully applied.
```

**2. Load the starting data** (products, staff accounts and two weeks of sample orders):

```bash
npm run db:seed
```

It prints a table of the demo accounts and ends with `The seed command has been executed.`

> ⚠️ **Run `npm run db:seed` only this first time.** It **erases everything** in the database and replaces it with sample data. Never run it once the shop has real orders.

---

## Part 7 — Build and start Piraso

**1. Build the app** (about 1–3 minutes, and the database must be running):

```bash
npm run build
```

**2. Start it:**

```bash
npm start
```

When you see

```
▲ Next.js 16.4.5
- Local:         http://localhost:3000
✓ Ready in ...
```

open **http://localhost:3000** in your browser. 🎉

**Keep this terminal window open** while you use Piraso; closing it stops the app. To stop Piraso, click the terminal and press **Ctrl + C**.

**Windows:** the first time, a *Windows Defender Firewall* window may ask about **Node.js**. Tick **Private networks** and click **Allow access**. This only matters if phones or other laptops will open Piraso; it's safe either way.

> To open Piraso on other phones and laptops (for example, panelists during a demo) without deploying it, see [Opening Piraso on other devices](#opening-piraso-on-other-devices-demos-and-panelists).

---

## Part 8 — Sign in and set up your shop

The sample data includes these accounts:

| Role | Email | Password |
|---|---|---|
| Owner | `owner@porkshop.test` | `Owner1234` |
| Worker (on duty) | `maria@porkshop.test` | `Worker1234` |
| Worker (on duty) | `jose@porkshop.test` | `Worker1234` |
| Worker (off duty) | `ana@porkshop.test` | `Worker1234` |
| Customer | `customer@porkshop.test` | `Customer1234` |

Sign in at http://localhost:3000/sign-in. The owner lands in the **Owner console**, workers in the **Worker station**, and customers in the **Shop**.

**Recommended first steps, signed in as the Owner:**

1. **Change the owner password:** avatar (top right) → *Profile & password*.
2. **Set your shop details:** *Settings* → shop name, opening hours, pickup slots and worker capacity.
3. **Set up your team:** *Workers* → *Add worker* for each real worker. Deactivate the sample workers (Maria, Jose and Ana) when you no longer need them.
4. **Review your products:** *Products* → edit prices and upload your own photos.
5. **Record your real stock:** *Stock levels* → *Record delivery*.
6. **Turn on GCash payments (optional):** *Settings* → *GCash payments* → tick *Accept GCash payments*, enter the account name and number, and upload the shop's GCash QR code (in the GCash app: *Receive* → *QR* → *Download*). Then *Save settings*.
7. **Check the time limits:** *Settings* → *Payment and pickup time limits*. By default, customers paying by GCash have **10 minutes** to submit their payment, and packed cash orders are held for **2 hours** after their pickup time. Orders past these limits are cancelled automatically and their stock goes back on sale.

The sample orders and sales history are there for practice. Ask your developer for a clean database with only your owner account when you're ready to go live.

---

## Everyday use: starting and stopping

**To start Piraso:**

1. Open **Docker Desktop** and wait for **Engine running**.
2. Open a terminal and run:

   ```bash
   cd ~/Projects/PorkShop
   docker compose up -d
   npm start
   ```

3. Open http://localhost:3000.

**To stop Piraso:** press **Ctrl + C** in the terminal. You can leave the database running, or stop it with `docker compose stop`. Shutting down the laptop is also safe; your data is kept.

You only need `npm run build` again after [getting updates](#getting-updates).

---

## Opening Piraso on other devices (demos and panelists)

Piraso doesn't have to be deployed for other people to use it. While it runs on your laptop, phones and laptops can open it in two ways:

| | A. Same Wi-Fi | B. Internet link (Cloudflare tunnel) |
|---|---|---|
| Who can open it | Devices on the same Wi-Fi or hotspot as your laptop | Anyone with the link, on any network |
| Address | `http://192.168.x.x:3000` (your laptop's address) | `https://some-random-words.trycloudflare.com` |
| Needs | Nothing extra | The free `cloudflared` program; no account |
| Live updates | Instant (status pill: **Live**) | Every 10 seconds (status pill: **Auto-refresh**) |

**Before a demo:**

- Start Piraso with `npm start` ([Part 7](#part-7--build-and-start-piraso)), not `npm run dev`. It's much faster on first load.
- Keep the laptop plugged in, and turn off sleep for the length of the demo.
- Open the address on your own phone first, so the first visit is already done.
- Panelists can tap **Sign up** to make their own customer accounts. Share the owner and worker logins only with the people who need them.

### A. Same Wi-Fi

1. Connect your laptop and the other devices to the **same Wi-Fi** (or turn on your phone's hotspot and connect everyone to it).
2. Start Piraso. The terminal shows your laptop's address on the **Network** line:

   ```
   - Local:         http://localhost:3000
   - Network:       http://192.168.1.23:3000
   ```

   No Network line? Find the address with `ipconfig` (Windows, look for **IPv4 Address**) or `ipconfig getifaddr en0` (macOS).
3. On the other devices, open that Network address, for example `http://192.168.1.23:3000`.
4. **Windows:** the first time, a *Windows Defender Firewall* window asks about **Node.js**. Tick **Private networks** and click **Allow access**. If the window never appeared and other devices can't connect, open *Settings* → *Network & internet* → *Wi-Fi* → your network, and set it to **Private network**.

> **School or office Wi-Fi often blocks devices from reaching each other.** If the page never loads on the other devices, use a phone hotspot or option B.

### B. Internet link (Cloudflare tunnel)

**1. Install `cloudflared` (one time).**

- **Windows:** in PowerShell, run

  ```powershell
  winget install --id Cloudflare.cloudflared
  ```

  Type **Y** if it asks to accept the terms. If `winget` *is not recognized* (older Windows 10), download **cloudflared-windows-amd64.msi** from https://github.com/cloudflare/cloudflared/releases/latest and run it instead.
- **macOS:** run `brew install cloudflared`. No `brew`? Install Homebrew first from https://brew.sh.

**Close the terminal and open a new one**, then check the install:

```bash
cloudflared --version
```

It should print a version, such as `cloudflared version 2026.11.0`.

**2. Start Piraso** in the first terminal, as usual:

```bash
cd ~/Projects/PorkShop
npm start
```

Leave this terminal open.

**3. Open a second terminal** and start the tunnel:

```bash
cd ~/Projects/PorkShop
npm run tunnel
```

**4. Copy the link.** After a few seconds the terminal shows a box like this:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://some-random-words.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Open that link on your phone first. **It can take up to a minute to start working**; if the phone says the site can't be reached, wait a little and reload. Then send the link to the panelists.

The terminal keeps printing lines that start with `INF`, `WRN` or `ERR`, such as *"no uptime guarantee"* or `ERR Request failed ... /api/events`. They're normal (the `/api/events` ones appear whenever someone closes or leaves a page); leave the window open.

**5. When the demo is over,** press **Ctrl + C** in the tunnel terminal. The link stops working immediately.

Things to know:
- **You get a new link every time** you run `npm run tunnel`, so share it on the day.
- **Anyone with the link can open Piraso.** Change the sample owner password first (*Profile & password*), and stop the tunnel when you're done.
- **Updates arrive within 10 seconds instead of instantly.** Tunnel links can't stream live updates, so open screens refresh on their own every 10 seconds. The staff status pill shows **Auto-refresh**; this is expected.
- **Both terminals must stay open**, and the laptop must stay online and awake.
- **Running Piraso on another port** (for example 3001)? Start the tunnel with `cloudflared tunnel --config quick-tunnel.yml --url http://localhost:3001` instead.

---

## Getting updates

When your developer releases a new version, stop Piraso (**Ctrl + C**), [back up your data](#backing-up-and-restoring-your-data), then run:

```bash
cd ~/Projects/PorkShop
git pull
npm install
npx prisma migrate deploy
npm run build
npm start
```

`npx prisma migrate deploy` updates the database tables and **keeps your data**. Don't run `npm run db:seed` when updating.

---

## Backing up and restoring your data

All orders, products, accounts and uploaded photos live in the database. Back it up regularly, for example every week and before every update. Docker must be running for these commands.

### Make a backup

From the `PorkShop` folder:

```bash
docker exec porkshop-db pg_dump -U porkshop -d porkshop --clean --if-exists -f /tmp/porkshop-backup.sql
docker cp porkshop-db:/tmp/porkshop-backup.sql ./porkshop-backup.sql
```

This creates `porkshop-backup.sql` in the `PorkShop` folder. Copy it somewhere safe, such as a USB drive or cloud storage, and rename it with the date (for example `porkshop-backup-2026-11-10.sql`).

### Restore a backup

> ⚠️ Restoring **replaces all current data** with the backup.

1. Stop Piraso (**Ctrl + C**).
2. Put the backup file in the `PorkShop` folder, named `porkshop-backup.sql`.
3. Run:

   ```bash
   docker compose up -d
   docker cp ./porkshop-backup.sql porkshop-db:/tmp/porkshop-backup.sql
   docker exec porkshop-db psql -U porkshop -d porkshop -q -v ON_ERROR_STOP=1 -f /tmp/porkshop-backup.sql
   ```

   It may print a few numbers (such as `1076`). That's normal.

4. Start Piraso again with `npm start`.

---

## Troubleshooting

Find the message you see, then follow the fix.

| What you see | What to do |
|---|---|
| `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system` (Windows) | Do [step 1.4](#14-windows-only-allow-powershell-to-run-npm), then try again. |
| `'git'` / `'node'` / `'docker'` *is not recognized*, or *command not found* | Close the terminal and open a new one. If it still happens, reinstall that tool ([Part 1](#part-1--install-the-tools-one-time)) and restart the computer. |
| `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | The `.env` file is missing or in the wrong folder. Do [Part 3](#part-3--create-the-settings-file-env) inside the `PorkShop` folder, then repeat the command. |
| `error during connect ... dockerDesktopLinuxEngine` (Windows) or `Cannot connect to the Docker daemon` (macOS) | Docker Desktop isn't running. Open it, wait for **Engine running**, and try again. |
| Docker Desktop says *WSL* or *virtualization* is required (Windows) | Open PowerShell as Administrator, run `wsl --install`, and restart. If it still fails, turn on **Virtualization (VT-x / AMD-V / SVM)** in your computer's BIOS settings (search your laptop model + "enable virtualization"). |
| `Bind for 0.0.0.0:5433 failed: port is already allocated` | Another program uses port 5433. In `docker-compose.yml` change `"5433:5432"` to `"5434:5432"`; in `.env` change `localhost:5433` to `localhost:5434`. Then run `docker compose up -d` again. |
| `Conflict. The container name "/porkshop-db" is already in use` | An older copy of the database container exists. Run `docker rm -f porkshop-db`, then `docker compose up -d`. This doesn't delete your data. |
| `Can't reach database server at localhost:5433` | The database isn't running. Open Docker Desktop, then run `docker compose up -d` and wait for **(healthy)** in `docker ps`. |
| `Error: listen EADDRINUSE: address already in use :::3000` | Port 3000 is in use (often Piraso is already running in another terminal). Close the other one, or run on another port: change both `localhost:3000` addresses in `.env` to `localhost:3001`, run `npm start -- -p 3001`, and open http://localhost:3001. |
| The sign-in button does nothing, or sign-in fails with a correct password | Stop Piraso with **Ctrl + C**, run `npm run build` and `npm start` again, then reload the page. If you edited `.env`, the restart is needed for the change to apply. |
| `'cloudflared' is not recognized` or `cloudflared: command not found` | Close the terminal and open a new one. If it still happens, install it again ([option B, step 1](#b-internet-link-cloudflare-tunnel)). |
| The tunnel link says *"This site can't be reached"* | Wait a minute and reload: new links take a moment to work. Check that both terminals (`npm start` and `npm run tunnel`) are still running, and use the link from the **latest** `npm run tunnel`; old links stop working. |
| The tunnel link shows *"Bad gateway"* or error **502** | Piraso isn't running. Start it with `npm start` in the other terminal, wait for **Ready**, and reload the link. |
| Other devices can't open Piraso | See [Opening Piraso on other devices](#opening-piraso-on-other-devices-demos-and-panelists). On the same Wi-Fi, allow **Node.js** through the Windows firewall; on school Wi-Fi, use a hotspot or a tunnel link. |
| Pages show *"Something went wrong"* or keep loading | The database probably stopped. Open Docker Desktop, run `docker compose up -d`, and refresh the page. |
| `npm run build` fails | Make sure the database is running (`docker ps` shows **porkshop-db (healthy)**), then run `npm run build` again. |
| `npm install` fails with network or `ETIMEDOUT` errors | Check your internet connection and run `npm install` again. It continues where it stopped. |

If something still doesn't work, send your developer a screenshot of the full terminal message.

---

## Removing Piraso

To delete Piraso **and all of its data** permanently:

```bash
cd ~/Projects/PorkShop
docker compose down -v
```

Then delete the `PorkShop` folder. You can uninstall Docker Desktop, Node.js and Git from your system settings if you don't need them for anything else.

---

## For developers

- **Development mode** (auto-reload when code changes, and one-tap demo-account buttons on the sign-in page): `npm run dev`. Pages are slower the first time each is opened.
- **Tests:** `npm test` (unit tests) and `npm run test:concurrency` (stress test against the database; it re-seeds afterwards, so **it erases data**).
- **Browse the database:** `npm run db:studio`.
- Architecture, features and design notes are in [README.md](README.md).
