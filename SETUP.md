# Running Porkshop on your own computer

This guide takes you from a brand-new laptop to Porkshop running at **http://localhost:3000**. Follow the parts in order and type each command exactly as shown.

- **Time needed:** about 30–45 minutes the first time, mostly waiting for downloads. After that, starting Porkshop takes under a minute.
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
7. [Build and start Porkshop](#part-7--build-and-start-porkshop)
8. [Sign in and set up your shop](#part-8--sign-in-and-set-up-your-shop)
- [Everyday use](#everyday-use-starting-and-stopping)
- [Getting updates](#getting-updates)
- [Backing up and restoring your data](#backing-up-and-restoring-your-data)
- [Troubleshooting](#troubleshooting)
- [Removing Porkshop](#removing-porkshop)

---

## Opening a terminal

Most steps are commands you type into a **terminal**:

- **Windows:** press the Start button, type **PowerShell**, and open **Windows PowerShell**.
- **macOS:** press `⌘ + Space`, type **Terminal**, and press Enter.

Type (or paste) a command, then press **Enter**. Wait until the command finishes before typing the next one.

---

## Part 1 — Install the tools (one time)

Porkshop needs three free programs: **Git** downloads the code, **Node.js** runs the app, and **Docker Desktop** runs the database.

### 1.1 Git

- **Windows:** download from https://git-scm.com/download/win and run the installer. Keep every default option and click **Next** until it finishes.
- **macOS:** open Terminal and run `xcode-select --install`, then click **Install** in the window that appears.

### 1.2 Node.js 24 (LTS)

Go to https://nodejs.org/en/download and download **version 24 (LTS)**. If the page offers a newer version by default, use its version menu to choose **v24**. Porkshop was tested with Node.js 24; version 22.12 or newer also works.

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

Create a **Projects** folder in your home folder and download Porkshop into it:

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

Porkshop reads its settings from a file named `.env`. **Create it before Part 5:** the package install in Part 5 fails without it.

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
| `BETTER_AUTH_URL` | The address you open Porkshop at: `http://localhost:3000`. |
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
- **Don't run `npm audit fix --force`.** It upgrades packages to versions Porkshop hasn't been tested with and can break it.
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

## Part 7 — Build and start Porkshop

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

**Keep this terminal window open** while you use Porkshop; closing it stops the app. To stop Porkshop, click the terminal and press **Ctrl + C**.

> Always open Porkshop at exactly `http://localhost:3000`. Signing in won't work at `http://127.0.0.1:3000` or any other address.

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

The sample orders and sales history are there for practice. Ask your developer for a clean database with only your owner account when you're ready to go live.

---

## Everyday use: starting and stopping

**To start Porkshop:**

1. Open **Docker Desktop** and wait for **Engine running**.
2. Open a terminal and run:

   ```bash
   cd ~/Projects/PorkShop
   docker compose up -d
   npm start
   ```

3. Open http://localhost:3000.

**To stop Porkshop:** press **Ctrl + C** in the terminal. You can leave the database running, or stop it with `docker compose stop`. Shutting down the laptop is also safe; your data is kept.

You only need `npm run build` again after [getting updates](#getting-updates).

---

## Getting updates

When your developer releases a new version, stop Porkshop (**Ctrl + C**), [back up your data](#backing-up-and-restoring-your-data), then run:

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

1. Stop Porkshop (**Ctrl + C**).
2. Put the backup file in the `PorkShop` folder, named `porkshop-backup.sql`.
3. Run:

   ```bash
   docker compose up -d
   docker cp ./porkshop-backup.sql porkshop-db:/tmp/porkshop-backup.sql
   docker exec porkshop-db psql -U porkshop -d porkshop -q -v ON_ERROR_STOP=1 -f /tmp/porkshop-backup.sql
   ```

   It may print a few numbers (such as `1076`). That's normal.

4. Start Porkshop again with `npm start`.

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
| `Error: listen EADDRINUSE: address already in use :::3000` | Port 3000 is in use (often Porkshop is already running in another terminal). Close the other one, or run on another port: change both `localhost:3000` addresses in `.env` to `localhost:3001`, run `npm start -- -p 3001`, and open http://localhost:3001. |
| The sign-in button does nothing, or sign-in fails with a correct password | Make sure the address in your browser exactly matches `BETTER_AUTH_URL` in `.env` (normally `http://localhost:3000`, not `127.0.0.1`). If you edited `.env`, stop Porkshop with **Ctrl + C** and run `npm start` again. |
| Pages show *"Something went wrong"* or keep loading | The database probably stopped. Open Docker Desktop, run `docker compose up -d`, and refresh the page. |
| `npm run build` fails | Make sure the database is running (`docker ps` shows **porkshop-db (healthy)**), then run `npm run build` again. |
| `npm install` fails with network or `ETIMEDOUT` errors | Check your internet connection and run `npm install` again. It continues where it stopped. |

If something still doesn't work, send your developer a screenshot of the full terminal message.

---

## Removing Porkshop

To delete Porkshop **and all of its data** permanently:

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
