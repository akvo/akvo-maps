# akvo-maps
Akvo Maps provide a Docker image of [Windshaft](https://github.com/CartoDB/Windshaft) based server.

## Usage

### Run

The latest docker image can be found at https://hub.docker.com/r/akvo/akvo-maps/ 

The image expects to find the configuration file at /config/environment.js. 
The provided configuration file will be merged with [the default configuration](windshaft/server/default-config.js)

The default configuration does not provides defaults for everything. You will need to provide some values. 
See [an configuraton file example](windshaft/config/dev/environment.js)

Some of the configuration is just passed to Windshaft. 
See the renderer section on [this example](https://github.com/CartoDB/Windshaft-cartodb/blob/master/config/environments/production.js.example#L100) 
for some documentation.

#### Redis

Windshaft uses Redis to store the queries, so a Redis DB must be made available and the configuration must point to it.

### API

See [Windshaft API docs](https://github.com/CartoDB/Windshaft/blob/master/doc/Multilayer-API.md)

Additionally, to create the layergroup, you need to provide the following headers:

1. X-DB-HOST: Postgres DB host.
1. X-DB-USER: Postgres DB user.
1. X-DB-PASSWORD: Postgres DB password.
1. X-DB-PORT: Postgres DB port.
1. X-DB-LAST-UPDATE. See [caching docs](docs/caching.md)

The host, user and password headers must an encrypted base64 byte array, using AES. The encryption key will be sha256 to get the correct bit-length. See [encryption](end-to-end-tests/test/windshaft_test/core_test.clj) and [decryption](windshaft/server/http/util.js)

### Javascript client example

See [an example](viewer/index.html) that uses [Leaflet](http://leafletjs.com).

## Development

Run:

```sh
docker-compose up 
```

This will create an environment with:

- two instances of windshaft, that will be restarted whenever there is a change in the "windshaft" folder
- postgres, with a running PostgreSQL + PostGis and a preloaded "test_database" database
- redis
- tests, with a Clojure REPL for end to end testing.

See the docker-compose.yml file for the enabled ports.

Once docker has started, you can use [the viewer](viewer/index.html) to play around with it.

### Running tests

Connect to the Clojure REPL and run them from there or run:

```sh
docker-compose run tests lein test
```