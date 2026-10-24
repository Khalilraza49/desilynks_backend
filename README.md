# DesiLynks Server

Backend for DesiLynks, built with NestJS, TypeScript, Prisma, PostgreSQL, Redis, Elasticsearch, and Firebase Cloud Messaging. It supports listings, jobs, community features, chat, moderation, and notifications.

The repository contains three applications:

| Application         | Purpose                                            | Default address on your computer |
| ------------------- | -------------------------------------------------- | -------------------------------- |
| API                 | User HTTP endpoints, uploads, and Socket.IO chat   | http://localhost:3000            |
| Admin API           | Administration, moderation, and content management | http://localhost:3001            |
| Notification worker | Processes BullMQ jobs and sends notifications      | Background process; no HTTP port |

## 1. Choose how to run the project

- **Local development:** PostgreSQL, Redis, and Elasticsearch run in Docker; the three NestJS applications run on your computer with watch mode. Use this when editing code.
- **Full Docker setup:** Infrastructure and all three applications run in Docker. The application images contain compiled code; rebuild them after source changes.

Follow sections 2–5 first, then choose section 6 or 7. Run every command from the repository root, beside `package.json` and `docker-compose.yml`.

The commands below load both Compose files together so infrastructure and application containers are managed as one project. Use the same pair of files for startup, logs, and shutdown.

## 2. Prerequisites

Before starting, prepare:

| Requirement                   | What you need                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker                        | Docker Engine with Compose, or Docker Desktop using Linux containers. Start Docker before running Compose commands.                                                              |
| Node.js and npm               | For local development, use Node.js 22.12 or newer within the 22.x line, or Node.js 24.x. The Dockerfiles use Node.js 22. Host Node.js is not required for the full Docker route. |
| PostgreSQL                    | Provided by Compose using PostgreSQL 15.                                                                                                                                         |
| Redis                         | Provided by Compose using Redis 7; used for sessions, caching, rate limiting, and queues.                                                                                        |
| Elasticsearch and Kibana      | Provided by the search Compose file. Allow enough Docker memory for two Elasticsearch nodes, Kibana, and the other services.                                                     |
| SMTP account                  | Host, port, username, password, and sender address for verification and password-reset emails.                                                                                   |
| Google / Apple configuration  | The Google OAuth client ID and Apple token audience used by your client applications.                                                                                            |
| Firebase service-account JSON | Credentials for the Firebase project used by the client apps, required for push notifications.                                                                                   |

Check the installed tools:

```sh
node --version
npm --version
docker --version
docker compose version
```

The Elasticsearch stack includes a privileged `sysctl-setup` service that sets `vm.max_map_count` in the Docker Linux environment. The Docker host must permit this operation.

## 3. Create and configure `.env`

Copy the example once, if you do not already have `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux / Git Bash:

```sh
cp .env.example .env
```

Edit `.env` before starting anything. The example is a template: its sample credentials are not ready for production mode, and its database URL must be aligned with `PG_DB`. Apply the values for your chosen run mode below instead of using the copied settings unchanged.

### Shared settings

These settings apply to both run modes:

| Variables                                          | What to configure                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `PG_USER`, `PG_PW`, `PG_DB`                        | PostgreSQL username, password, and database. Use `PG_DB=desilynks`. The same username, password, and database must appear in `DATABASE_URL`.    |
| `PG_ADMIN_EMAIL`, `PG_ADMIN_PASSWORD`              | Login credentials for the pgAdmin web interface. They are separate from the PostgreSQL credentials.                                             |
| `REDIS_PASSWORD`                                   | Password used by both the Redis container and the applications. Keep it nonempty with the supplied Compose configuration.                       |
| `JWT_SECRET`, `ADMIN_JWT_SECRET`                   | Different random signing secrets for user and admin tokens. Production mode requires each to be at least 32 characters.                         |
| `JWT_SECRET_EXPIRY`, `ADMIN_JWT_SECRET_EXPIRY`     | Token lifetimes, for example `30m`.                                                                                                             |
| `ADMIN_SEED_SECRET`                                | Key for creating the first admin. Use a random value of at least 32 characters; production validates its length when set.                       |
| `MAIL_HOST`, `MAIL_PORT`                           | Your SMTP server and port. The mail transport uses `secure: false`; use a provider configuration compatible with STARTTLS, commonly port `587`. |
| `MAIL_USER`, `MAIL_PASSWORD`                       | SMTP authentication credentials.                                                                                                                |
| `MAIL_FROM`                                        | Sender name and verified address, for example `"DesiLynks <your-verified-address@example.com>"`.                                                |
| `GOOGLE_CLIENT_ID`                                 | Google OAuth client ID matching the audience of tokens sent by the client app.                                                                  |
| `APPLE_BUNDLE_ID`                                  | Apple audience expected by this backend; match the actual audience in your client app's Apple ID tokens.                                        |
| `ELASTIC_SECURITY_ENABLED`                         | Keep `true` for the supplied authenticated search setup.                                                                                        |
| `ELASTIC_PASSWORD`                                 | Password for Elasticsearch's built-in `elastic` user.                                                                                           |
| `KIBANA_PASSWORD`                                  | Password assigned to the internal `kibana_system` user by the setup container.                                                                  |
| `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` | Application search credentials. Use `desilynks_app` and a nonempty password; the setup container creates this user and assigns its role.        |
| `ES_JAVA_OPTS`                                     | Heap options for each Elasticsearch node, for example `"-Xms512m -Xmx512m"` for development. Docker needs additional memory beyond these heaps. |
| `ELASTICSEARCH_MAX_RETRIES`                        | Client retry limit; example value: `3`.                                                                                                         |
| `ELASTICSEARCH_REQUEST_TIMEOUT`                    | Client timeout in milliseconds; example value: `30000`.                                                                                         |
| `ELASTICSEARCH_SNIFF_ON_START`                     | Keep `false`, especially when connecting from your computer to published Docker ports.                                                          |

Generate three separate secrets with Node.js, then copy the output into `.env`:

```sh
node -e "const { randomBytes } = require('node:crypto'); for (const key of ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_SEED_SECRET']) console.log(key + '=' + randomBytes(32).toString('hex'));"
```

For the full Docker route without host Node.js, generate equivalent random values with your password manager. Do not reuse the short sample secrets from `.env.example` when `NODE_ENV=production`.

If using Gmail with this password-based SMTP transport, configure an app password where your account supports it. Google requires 2-Step Verification for app passwords. See [Google's app-password instructions](https://support.google.com/accounts/answer/185833).

The API validates that the mail settings, `GOOGLE_CLIENT_ID`, and `APPLE_BUNDLE_ID` are nonempty even in development. Nonempty placeholders can let you start while working on unrelated features, but they do not enable email delivery or social sign-in. Use actual provider credentials to test those flows.

### Values for local development

When the applications run through npm on your computer, use these values in `.env`:

```dotenv
NODE_ENV=development
PORT=3000
ADMIN_PORT=3001

PG_USER=admin
PG_DB=desilynks
DATABASE_URL="postgresql://admin:YOUR_DB_PASSWORD@localhost:5432/desilynks?schema=public"

REDIS_HOST=localhost
REDIS_PORT=6378

ELASTICSEARCH_NODES=http://localhost:9200,http://localhost:9201
ELASTICSEARCH_USERNAME=desilynks_app

FIREBASE_SERVICE_ACCOUNT_PATH=./desilynks-chat-firebase.json
```

Set `PG_PW` to your chosen password and replace `YOUR_DB_PASSWORD` with that same password in the URL. Percent-encode special characters in the URL's username or password. Keep all the other shared settings from the previous table.

The Redis host port is **6378**, because Compose publishes container port `6379` as `127.0.0.1:6378`. The local admin process uses **3001** so it does not conflict with the API on **3000**.

### Values for full Docker startup

When the applications also run inside Docker, use these values instead:

```dotenv
NODE_ENV=production
PORT=3000
ADMIN_PORT=3000

PG_USER=admin
PG_DB=desilynks
DATABASE_URL="postgresql://admin:YOUR_DB_PASSWORD@postgres:5432/desilynks?schema=public"

REDIS_HOST=redis
REDIS_PORT=6379

ELASTICSEARCH_NODES=http://es01:9200,http://es02:9200
ELASTICSEARCH_USERNAME=desilynks_app

FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/desilynks-chat-firebase.json
```

Again, match the URL password to `PG_PW` and complete the shared settings. This route uses production-mode validation even when you are testing the containers on a development computer.

`postgres`, `redis`, `es01`, and `es02` are Docker service names. They resolve inside the shared Docker network. Inside an application container, `localhost` points back to that container.

Both HTTP applications listen on container port **3000**, in separate containers. Compose publishes the API at host port **3000** and the admin API at host port **3001**. Keep `ADMIN_PORT=3000` for the supplied Docker port mapping.

## 4. Prepare Firebase credentials

1. Open the Firebase project used by the client applications.
2. Open **Project settings → Service accounts** and generate a private key JSON file, or obtain the project's existing service-account key through your team's credential-sharing process.
3. Save the file as `desilynks-chat-firebase.json` in the repository root.

See the [Firebase Admin setup instructions](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments) for obtaining a service-account key.

The expected layout is:

```text
desilynks-server/
├── .env
├── .env.example
├── desilynks-chat-firebase.json
├── docker-compose.yml
├── docker-compose.elasticsearch.yml
├── package.json
├── apps/
├── libs/
└── prisma/
```

The API and worker use this Docker mount:

```yaml
volumes:
  - ./desilynks-chat-firebase.json:/run/secrets/desilynks-chat-firebase.json:ro
```

| Part                                        | Meaning                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `./desilynks-chat-firebase.json`            | Existing file beside the Compose file on your computer or server. |
| `/run/secrets/desilynks-chat-firebase.json` | Path where that file is visible inside the container.             |
| `ro`                                        | Read-only access from the container.                              |

This is a bind-mounted file; `/run/secrets` is the chosen container location. You do not need to create that directory on your computer.

The Compose `environment:` setting explicitly sets `FIREBASE_SERVICE_ACCOUNT_PATH` for the API and worker. It overrides the value loaded through `env_file`, as described in [Docker's environment precedence documentation](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/).

Create the actual JSON file before starting these containers. The file and `.env` are excluded from Git; the credentials file is also excluded from Docker image builds.

For **local development only**, a missing Firebase file logs a warning and disables push sending. With `NODE_ENV=production`, the API and worker fail startup if the file is missing. The full Docker route in this guide therefore requires it.

## 5. Start the infrastructure

Complete `.env` for your chosen run mode first.

Create the external network once:

```sh
docker network create desilynks-shared-network
```

If Docker reports that the network already exists, continue with the existing network.

Validate the combined configuration without starting containers:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml config --quiet
```

Start PostgreSQL, Redis, pgAdmin, both Elasticsearch nodes, and Kibana:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml up -d postgres redis pgadmin es01 es02 kibana
```

This also starts the Elasticsearch setup services through their dependencies. The setup creates certificates, configures the internal Kibana password, and creates the application search user and role.

Check progress:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml logs -f setup
```

Wait for `Setup complete!`, successful completion of the setup container, and healthy PostgreSQL, Redis, and Elasticsearch containers before starting the applications. Press `Ctrl+C` to stop following logs; detached containers keep running.

## 6. Run the applications locally

Use the **local development** values from section 3. If application containers from a previous run are using ports 3000/3001, stop them first:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml stop app admin-api notification-worker
```

### Install dependencies and apply migrations

```sh
npm ci
npx prisma migrate deploy
```

`npm ci` installs the versions in `package-lock.json`. Its post-install hook runs `prisma generate`, which writes the client to `generated/prisma`. Create `.env` before installation so the Prisma configuration can load it.

`prisma migrate deploy` applies the existing migrations to your configured database. Run it after PostgreSQL is ready and before starting any application. For a new database, it creates the application's tables.

If you previously installed dependencies with scripts disabled, generate the client explicitly:

```sh
npm run prisma:generate
```

### Start all three processes

Open three terminals in the repository root.

Terminal 1 — API:

```sh
npm run start:dev
```

Terminal 2 — admin API:

```sh
npm run start:admin:dev
```

Terminal 3 — notification worker:

```sh
npm run start:worker:dev
```

These commands watch for source changes. Keep the worker running when testing queued notifications. Local uploads are stored under `uploads/`, shared by the API and admin API when both run from this directory.

## 7. Run all applications in Docker

Use the **full Docker** values from section 3, provide the Firebase file, and complete the infrastructure startup in section 5. Stop any local npm processes occupying ports 3000/3001.

Build and start the API first:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml up -d --build app
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml logs -f app
```

The API container runs `npx prisma migrate deploy` before starting NestJS. Wait for migrations to complete and the API to start successfully, then press `Ctrl+C` to leave the log view.

Start the other applications:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml up -d --build admin-api notification-worker
```

The admin API and worker do not run migrations. Their Compose dependencies wait for PostgreSQL and Redis health, but do not wait for the API's migration command; this is why the first startup is staged.

You do not need to run `npm ci` on your computer for this route. The Dockerfiles install dependencies, generate Prisma, and compile the applications during image builds. API and admin uploads share the `desilynks-uploads` volume.

After editing source code, rebuild the affected service with the same `up -d --build` command. Editing `.env` requires recreating the affected application containers with `up -d`; a plain container restart does not load new environment settings.

## 8. Verify startup and create the first admin

| Service                       | Address / connection                            | Expected use                                                                                                                          |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| API                           | http://localhost:3000/                          | Returns `Hello 👋 from DesiLynks server!`.                                                                                            |
| Admin API                     | http://localhost:3001/                          | Returns `Welcome to the Admin API!`.                                                                                                  |
| Socket.IO                     | API server, namespace `/chat`                   | Authenticated chat and realtime events.                                                                                               |
| pgAdmin                       | http://localhost:5050                           | Sign in with `PG_ADMIN_EMAIL` / `PG_ADMIN_PASSWORD`. Register PostgreSQL using host `postgres`, port `5432`, and `PG_USER` / `PG_PW`. |
| PostgreSQL from your computer | `localhost:5432`                                | Database `desilynks`, using your PostgreSQL credentials.                                                                              |
| Redis from your computer      | `localhost:6378`                                | Use `REDIS_PASSWORD`.                                                                                                                 |
| Elasticsearch                 | http://localhost:9200 and http://localhost:9201 | Requires configured Elasticsearch credentials.                                                                                        |
| Kibana                        | http://localhost:5601                           | For development administration, sign in as `elastic` with `ELASTIC_PASSWORD`. `KIBANA_PASSWORD` is for Kibana's internal connection.  |

The Docker port mappings bind to `127.0.0.1`, so these URLs are available on the machine running Docker. An HTTP greeting confirms the server is responding; test email delivery, social login, search, and push notifications separately with your provider configuration.

### Create the first admin

There is no automatic admin account. After migrations and admin API startup, use an HTTP client such as Postman:

```http
POST http://localhost:3001/auth/seed-admin
Content-Type: application/json
x-seed-key: YOUR_ADMIN_SEED_SECRET
```

Send this body with your own account details:

```json
{
  "firstName": "Dev",
  "lastName": "Admin",
  "email": "admin@example.com",
  "phoneNumber": "+12025550123",
  "password": "replace-with-your-admin-password"
}
```

The header must match `ADMIN_SEED_SECRET`. Supply a valid international phone number and a password of at least 8 characters. The endpoint only works while there are no admins; once one exists, further seed requests are rejected. Log in through `POST http://localhost:3001/auth/login` using that email and password.

## 9. Useful commands

### Build and checks

Run these on your computer after installing dependencies and generating Prisma:

| Command                                              | Purpose                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run build:all`                                  | Build the API, worker, and admin API.                                                         |
| `npm run build:api`                                  | Build only the API.                                                                           |
| `npm run build:admin`                                | Build only the admin API.                                                                     |
| `npm run build:worker`                               | Build only the worker.                                                                        |
| `npm run start:prod`                                 | Run the built API.                                                                            |
| `npm run start:admin:prod`                           | Run the built admin API.                                                                      |
| `npm run start:worker:prod`                          | Run the built worker.                                                                         |
| `npm run lint`                                       | Check TypeScript lint rules without changing files.                                           |
| `npm run lint:fix`                                   | Apply available lint fixes.                                                                   |
| `npm test`                                           | Run unit tests.                                                                               |
| `npm run test:e2e`                                   | Run the HTTP test suite; it loads the application configuration.                              |
| `npm run test:cov`                                   | Run tests with coverage.                                                                      |
| `npm run prisma:generate`                            | Regenerate Prisma after schema changes.                                                       |
| `npx prisma migrate deploy`                          | Apply existing migrations.                                                                    |
| `npx prisma migrate dev --name describe_your_change` | Create and apply a migration while developing a schema change against a development database. |

The `start:*:prod` scripts run compiled files; they do not set `NODE_ENV` themselves. Use the environment values appropriate for where those processes run.

### Search data

The API and admin API attempt to create missing search indices at startup. If Elasticsearch is freshly reset but PostgreSQL already contains listings, repopulate search from the database.

For local applications:

```sh
npm run build:api
npm run reindex
```

For the running Docker API:

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml exec app npm run reindex
```

`npm run reindex:fresh` deletes and recreates the application search indices before repopulating them. It does not delete PostgreSQL records. Reindexing loads the API configuration, so its environment and dependencies must be available.

### Logs and shutdown

```sh
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml logs -f app admin-api notification-worker
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml logs -f es01 es02 setup
docker compose -f docker-compose.yml -f docker-compose.elasticsearch.yml down
```

`down` removes the project's containers while retaining its named data volumes. The external `desilynks-shared-network` also remains. For local npm processes, press `Ctrl+C` in each terminal.

## 10. Troubleshooting

| Problem                                               | Check / fix                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration`                   | Read the named variables in the error. Complete `.env`; in production, use different user/admin JWT secrets of at least 32 characters and a sufficiently long seed secret when configured.                                                                        |
| Database does not exist                               | Match the database part of `DATABASE_URL` to `PG_DB=desilynks`. PostgreSQL initialization variables only create the database on a fresh data volume; changing `.env` does not rename an existing database.                                                        |
| Cannot resolve `postgres`, `redis`, or `es01` locally | Use the localhost addresses from the local configuration block. Docker service names are for container-to-container connections.                                                                                                                                  |
| Redis connection refused from local Node.js           | Use `REDIS_PORT=6378` with the supplied port mapping. Inside Docker, use `6379`.                                                                                                                                                                                  |
| Address already in use                                | Stop the competing process/container. For local development, set `PORT=3000` and `ADMIN_PORT=3001`.                                                                                                                                                               |
| Admin container starts but port 3001 does not respond | Keep `ADMIN_PORT=3000` inside Docker; Compose maps host port 3001 to container port 3000.                                                                                                                                                                         |
| External network not found                            | Create `desilynks-shared-network` before starting either Compose configuration.                                                                                                                                                                                   |
| Firebase file missing or reported as a directory      | Put a real service-account JSON at the host mount source before container startup. Use the correct local/container path. If an earlier missing-file mount created a directory with that name, replace it with the JSON file and recreate the affected containers. |
| Elasticsearch authentication fails                    | Wait for `Setup complete!`. Match `ELASTICSEARCH_USERNAME` and `ELASTICSEARCH_PASSWORD` between setup and the applications. After changing credentials, rerun the setup service and recreate the application containers.                                          |
| Elasticsearch does not start                          | Check `sysctl-setup` and node logs, available Docker memory, and whether privileged setup is permitted on the Docker host.                                                                                                                                        |
| Emails are not delivered                              | Check the SMTP host/port, authentication, and verified sender. For Gmail, check app-password eligibility and configuration.                                                                                                                                       |
| Notifications are not processed                       | Keep the worker running, use the same database and Redis settings as the API, and verify the Firebase project matches the clients' registration tokens.                                                                                                           |
| Generated Prisma module is missing                    | Run `npm run prisma:generate`; make sure dependency install scripts were not skipped.                                                                                                                                                                             |
| Tables are missing                                    | Run the existing migrations against the correct database before starting local applications; for Docker, let the API finish its migration step before starting the admin API and worker.                                                                          |
| Empty search results after resetting Elasticsearch    | Run the reindex command after the cluster and application search credentials are ready.                                                                                                                                                                           |

## Project layout

```text
apps/api/                  User HTTP API and Socket.IO gateway
apps/admin-api/            Admin HTTP API
apps/notification-worker/  BullMQ notification processors
libs/common/               Shared configuration and services
prisma/schema.prisma       Database models
prisma/migrations/         Database migration history
test/                      HTTP tests and shared test mocks
Dockerfile                 API image
Dockerfile.admin           Admin API image
Dockerfile.worker          Notification worker image
docker-compose.yml         Applications, PostgreSQL, Redis, and pgAdmin
docker-compose.elasticsearch.yml  Search cluster, setup, and Kibana
```
