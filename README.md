<div align="center">
    <img width="64" alt="drawDB logo" src="./src/assets/icon-dark.png">
    <h1>drawDB</h1>
</div>

<h3 align="center">Self-hosted database schema editor — diagrams stored on your own server, private to each account.</h3>

<h3 align="center"><img width="700" style="border-radius:5px;" alt="drawDB screenshot demo" src="drawdb.png"></h3>

drawDB is a robust and user-friendly database entity relationship diagram (ERD)
editor. Build diagrams with a few clicks, export and import SQL scripts,
generate migrations, customize your editor, and more. See the full set of
features [here](https://drawdb.app/).

## About this fork

This is a fork of [drawdb-io/drawdb](https://github.com/drawdb-io/drawdb).
Upstream drawDB is browser-only: diagrams live in the browser's IndexedDB, so
they are tied to one machine, invisible to any other device, and gone with the
profile. This fork turns the same editor into a self-hosted instance with
accounts.

| | Upstream drawDB | This fork |
| --- | --- | --- |
| Diagram storage | IndexedDB, in the browser | one JSON file per diagram, on the server |
| Accounts | none | [Better Auth](https://better-auth.com) + SQLite, in the same process |
| Visibility | whatever that browser holds | each diagram private to its owner |
| Home page | landing page | the diagram collection, once one diagram exists |
| Runtime | static frontend behind nginx | one Node process serving the frontend and the API |

Everything else is upstream's and works unchanged: the editor itself, SQL
import and export, the templates gallery, and the optional sharing backend.

The trade-off is deliberate — the fork gives up "no account needed" to gain
diagrams that are durable, shared across devices, and backed up like any other
file on the server.

## Getting Started

### Local Development

Requires Node 24 or newer, for the built-in `node:sqlite` module backing the
account database.

Requires Node 24 or newer, for the built-in `node:sqlite` module backing the
account database.

```bash
git clone https://github.com/gabrielhalus/drawdb
cd drawdb
npm install
npm run dev
```

Then open the app and create the first account, which owns the instance.

Then open the app and create the first account, which owns the instance.

### Build

```bash
git clone https://github.com/gabrielhalus/drawdb
cd drawdb
npm install
npm run build
```

### Docker Build

```bash
docker build -t drawdb .
docker run -p 3000:3000 -v drawdb-data:/data drawdb
```

The container serves the frontend and the diagram API on the same port. Mount a
volume at `/data` so stored diagrams survive a restart.

## Server-side storage

This fork stores diagrams on the server instead of in the browser. Each diagram
is a single JSON file named after its ID:

```
data/diagrams/592c09c8-0cff-463f-bfdc-0f37c3713191.json
```

`DIAGRAM_STORE_PATH` sets the directory and defaults to `./data/diagrams`.
Because each diagram is a plain JSON document, the stored data is easy to
inspect, back up, diff, or commit to version control. Writes go to a temporary
file and are then renamed into place, so an interrupted write cannot truncate an
existing diagram.

`npm run dev` starts the API on port `3000` and the Vite frontend on `5173`
together; use `npm run dev:client` or `npm run dev:server` to run just one. The
dev server proxies `/api` to the API so both share an origin, which is what lets
the session cookie travel with every request. `npm start` serves the built
frontend and the API from a single process.

The application exposes:

- `GET|POST /api/diagrams`
- `GET|PUT|DELETE /api/diagrams/:diagramId`
- `GET /api/diagrams/latest`
- `GET /api/diagrams/by-gist/:gistId`
- `GET /api/instance`
- `ALL /api/auth/*` (handled by Better Auth)

Every `/api/diagrams` route requires a session and only ever sees the signed-in
account's own diagrams.

## Accounts

Diagrams are private per account, so the instance needs sign-in. Authentication
is handled by [Better Auth](https://better-auth.com) running inside this server
— there is no third-party service and no account to create anywhere else.
Accounts and sessions live in a SQLite file (`AUTH_DB_PATH`, default
`./data/auth.db`) through Node's built-in `node:sqlite`, which is why **Node 24
or newer is required** and why there is still no native dependency to build.

Diagrams themselves stay plain JSON files; each one simply records the
`ownerId` of the account that created it.

### First run

The first account to register owns the instance, and **registration closes as
soon as it exists**. Open the app, create that account, and the sign-up form
turns into "ask the owner for an account" for everybody else. Set
`ALLOW_SIGNUP=true` to keep registration open.

Upgrading an instance that already held diagrams needs nothing: diagrams saved
before sign-in was required have no owner yet, and the first account created
adopts all of them.

### Configuration

| Variable | Purpose |
| --- | --- |
| `AUTH_DB_PATH` | SQLite file holding accounts and sessions. Defaults to `./data/auth.db`. |
| `AUTH_BASE_URL` | Public URL of the instance. **Set this in production**: its scheme is what marks the session cookie secure over HTTPS. |
| `AUTH_TRUSTED_ORIGINS` | Extra comma-separated origins allowed to call the API. Only needed behind a reverse proxy that rewrites `Host`; same-origin requests are always accepted. |
| `BETTER_AUTH_SECRET` | Signs session cookies. Generated once into `./data/auth.secret` when unset, so sessions survive a restart with no configuration. Set it explicitly to share one value across several instances. |
| `ALLOW_SIGNUP` | `true` keeps registration open after the first account exists. |

Keep the `/data` volume: losing `auth.db` loses the accounts, and losing
`auth.secret` signs everyone out.

### Home page

The home page adapts to what is stored: with no saved diagrams it shows the
landing page, and as soon as one exists it becomes the diagram collection. The
landing page stays permanently available at `/welcome`, and the collection at
`/collection`.

`/`, `/collection` and `/editor/*` require a session and send visitors to
`/sign-in` otherwise. `/welcome`, `/templates` and `/bug-report` stay open —
nothing there reads a user's collection.

The container serves the frontend and the diagram API on the same port. Mount a
volume at `/data` so stored diagrams survive a restart.

## Server-side storage

Diagrams are stored on the server instead of in the browser. Each diagram is a
single JSON file named after its ID:

```
data/diagrams/592c09c8-0cff-463f-bfdc-0f37c3713191.json
```

`DIAGRAM_STORE_PATH` sets the directory and defaults to `./data/diagrams`.
Because each diagram is a plain JSON document, the stored data is easy to
inspect, back up, diff, or commit to version control. Writes go to a temporary
file and are then renamed into place, so an interrupted write cannot truncate an
existing diagram.

`npm run dev` starts the API on port `3000` and the Vite frontend on `5173`
together; use `npm run dev:client` or `npm run dev:server` to run just one. The
dev server proxies `/api` to the API so both share an origin, which is what lets
the session cookie travel with every request. `npm start` serves the built
frontend and the API from a single process.

The application exposes:

- `GET|POST /api/diagrams`
- `GET|PUT|DELETE /api/diagrams/:diagramId`
- `GET /api/diagrams/latest`
- `GET /api/diagrams/by-gist/:gistId`
- `GET /api/instance`
- `ALL /api/auth/*` (handled by Better Auth)

Every `/api/diagrams` route requires a session and only ever sees the signed-in
account's own diagrams. A diagram belonging to somebody else answers `404`
rather than `403`, so the API never confirms that an ID exists in another user's
collection.

## Accounts

Diagrams are private per account, so the instance needs sign-in. Authentication
is handled by [Better Auth](https://better-auth.com) running inside this server
— there is no third-party service and no account to create anywhere else.
Accounts and sessions live in a SQLite file (`AUTH_DB_PATH`, default
`./data/auth.db`) through Node's built-in `node:sqlite`, which is why **Node 24
or newer is required** and why there is still no native dependency to build.

Diagrams themselves stay plain JSON files; each one simply records the
`ownerId` of the account that created it.

### First run

The first account to register owns the instance, and **registration closes as
soon as it exists**. Open the app, create that account, and the sign-up form
turns into "ask the owner for an account" for everybody else. Set
`ALLOW_SIGNUP=true` to keep registration open.

Upgrading an instance that already held diagrams needs nothing: diagrams saved
before sign-in was required have no owner yet, and the first account created
adopts all of them.

### Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | Port the server listens on. Defaults to `3000`. |
| `DIAGRAM_STORE_PATH` | Directory holding one JSON file per diagram. Defaults to `./data/diagrams`. |
| `AUTH_DB_PATH` | SQLite file holding accounts and sessions. Defaults to `./data/auth.db`. |
| `AUTH_BASE_URL` | Public URL of the instance. **Set this in production**: its scheme is what marks the session cookie secure over HTTPS. |
| `AUTH_TRUSTED_ORIGINS` | Extra comma-separated origins allowed to call the API. Only needed behind a reverse proxy that rewrites `Host`; same-origin requests are always accepted. |
| `BETTER_AUTH_SECRET` | Signs session cookies. Generated once into `./data/auth.secret` when unset, so sessions survive a restart with no configuration. Set it explicitly to share one value across several instances. |
| `ALLOW_SIGNUP` | `true` keeps registration open after the first account exists. |

See `.env.sample` for a commented starting point.

Keep the `/data` volume: losing `auth.db` loses the accounts, and losing
`auth.secret` signs everyone out.

### Routes

The home page adapts to what is stored: with no saved diagrams it shows the
landing page, and as soon as one exists it becomes the diagram collection. The
landing page stays permanently available at `/welcome`, and the collection at
`/collection`.

`/`, `/collection` and `/editor/*` require a session and send visitors to
`/sign-in` otherwise. `/welcome`, `/templates` and `/bug-report` stay open —
nothing there reads a user's collection.

## Sharing

Sharing is unchanged from upstream and stays optional. To enable it, set up the
[drawDB server](https://github.com/drawdb-io/drawdb-server) and the matching
environment variables from `.env.sample`. Note that this is a separate service
from the diagram API described above, which this fork always runs.

With the Docker image, pass the server URL when starting the container. No
rebuild is needed:

```bash
docker run -p 3000:3000 -e VITE_BACKEND_URL=https://your-drawdb-server.example.com drawdb
```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to
contribute to this project.

## Upstream

- Upstream project: [drawdb-io/drawdb](https://github.com/drawdb-io/drawdb)
- Hosted instance: [drawdb.app](https://drawdb.app/)
- Join discussions: [Discord](https://discord.gg/BrjZgNrmR6)
