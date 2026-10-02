<div align="center">
    <img width="64" alt="drawDB logo" src="./src/assets/icon-dark.png">
    <h1>drawDB</h1>
</div>

<h3 align="center">Free, simple, and intuitive database schema editor and SQL generator.</h3>

<div align="center" style="margin-bottom:12px;">
    <a href="https://drawdb.app/" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/badge/Start%20building-grey" alt="drawDB"/>
    </a>
    <a href="https://discord.gg/BrjZgNrmR6" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/discord/1196658537208758412.svg?label=Join%20the%20Discord&logo=discord" alt="Discord"/>
    </a>
    <a href="https://x.com/drawDB_" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/badge/Follow%20us%20on%20X-blue?logo=X" alt="Follow us on X"/>
    </a>
</div>

<h3 align="center"><img width="700" style="border-radius:5px;" alt="drawDB screenshot demo" src="drawdb.png"></h3>

DrawDB is a robust and user-friendly database entity relationship diagram (ERD) editor right in your browser. Build diagrams with a few clicks, export and import SQL scripts, generate migrations, customize your editor, and more without creating an account. See the full set of features on [here](https://drawdb.app/).

## Getting Started

### Local Development

```bash
git clone https://github.com/drawdb-io/drawdb
cd drawdb
npm install
npm run dev
```

### Build

```bash
git clone https://github.com/drawdb-io/drawdb
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
together; use `npm run dev:client` or `npm run dev:server` to run just one.
`npm start` serves the built frontend and the API from a single process.

The application exposes:

- `GET|POST /api/diagrams`
- `GET|PUT|DELETE /api/diagrams/:diagramId`
- `GET /api/diagrams/latest`
- `GET /api/diagrams/by-gist/:gistId`

### Home page

The home page adapts to what is stored: with no saved diagrams it shows the
landing page, and as soon as one exists it becomes the diagram collection. The
landing page stays permanently available at `/welcome`, and the collection at
`/collection`.

If you want to enable sharing, set up the [server](https://github.com/drawdb-io/drawdb-server) and environment variables according to `.env.sample`. This is optional unless you need to share files.

With the Docker image, pass the server URL when starting the container. No rebuild is needed:

```bash
docker run -p 3000:80 -e VITE_BACKEND_URL=https://your-drawdb-server.example.com ghcr.io/drawdb-io/drawdb:latest
```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Support
- Join discussions: [Discord](https://discord.gg/BrjZgNrmR6)
