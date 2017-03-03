# AKVO MapService

## An Overview

Sandro Santilli &lt;strk@kbt.io&gt;

---

## What we have

--

 - A public git repository https://github.com/akvo/akvo-maps/ consisting of:

--

 - A bunch of [Docker](https://www.docker.com/) images (`images/`)

--

 - A set of Makefiles to build all images and run the system  (`*/Makefile`)

???

I guess I could have used docker-compose

--

 - An example service client (`viewer/`)

--

 - Docs and utility scripts

--

 - GNU GPLv3 license

---

## What we have
### Docker images for:

???

All images except "nginx" are based on a "base" image
`images/base/Dockerfile` which is based on Ubuntu 16.04

--


 - Database (`images/postgis`)

--

 - Key-value store (`images/redis`)

--

 - Tiler (`images/tiler`)

--

 - Authentication layer (`images/nginx-secured`)

--

 - Shared clients cache (`images/varnish`)
 
---

## What we have - Docker images
### Database (`akvo-postgis`)

- `images/postgis/Dockerfile`

--
- [PostgreSQL](https://www.postgresql.org/) server (9.5)

--
- [PostGIS](http://postgis.net) extension (2.2)

--
- Example spatial database (akvo)

--
- Preloaded data (Liberia points)

--

.center[![PostGISLogo](https://upload.wikimedia.org/wikipedia/en/6/60/PostGIS_logo.png)]

???

In a real deploy you might have multiple databases, as long as you
spatially-enable each one. With some tiler-server tweaks you could
also have multiple database *servers* (for example to improve
availability or speed with a replicated environment).

---

## What we have - Docker images
### Key-value store (`akvo-redis`)

- `images/redis/Dockerfile`

--
- [Redis](https://redis.io/) server (3.0)

--
- Used by the Tiler to store map configurations

--

.center[![RedisLogo](https://chrysohous.files.wordpress.com/2012/08/redis.png)]

???

If you need to scale up tilers you can use this shared cache to give
all tilers a central fast key-value store to lookup map configurations,
no matter which tiler got to process the initial map creation request.

---

## What we have - Docker images
### Tiler (`akvo-tiler`)

- `images/tiler/Dockerfile`

--
- [Windshaft](https://github.com/CartoDB/Windshaft) based HTTP Tiler API

???

Windshaft is a CartoDB component, BSD licensed.
- Uses Mapnik renderer to create tiles from PostGIS data (both vector and raster)
- Can also serve record attributes directly querying PostgreSQL
- Only state is the map configuration (in redis), expiring when unused

--
- Uses Windshaft fork for [SRID patch](https://github.com/CartoDB/Windshaft/pull/529)

???

Needed to not enforce a specific SRS to the data

--
- Configurable API endpoints

???

To let you more easily plug filter layers

--
- Data update handling for cache management

???

Allows encoding time of last data modification (as found in an `updated_at`
record field, if any) into the token used to fetch tiles/attributes.

--

.center[![SampleTile](https://raw.githubusercontent.com/CartoDB/Windshaft/master/examples/images/screen_3.png)]


---

## What we have - Docker images
### Authentication layer (`akvo-nginx-secured`)

- `images/nginx-secured/Dockerfile`

--
- Based on [OpenResty](https://openresty.org) (NGINX + LUA)

--
- JWT verification to allow POSTs (used to create maps)

--
- Proxies to underlying tiler

--

.center[![OpenResty Logo](http://openresty.org/images/logo.png)]

---

## What we have - Docker images
### Shared clients cache (`akvo-varnish`)

- `images/varnish/Dockerfile`

--
- [Varnish](https://www.varnish-cache.org) HTTP cache (4.1)

--
- Never-invalidated cache for tile users

--

.center[![Varnish Logo](https://www.varnish-cache.org/_static/varnish-bunny.png)]

---

## What we have
### Scripts to build and run the system


- `make build` builds all docker images

--

```
$ make build
...
$ docker images --format '{{.Size}}\t{{.Repository}}' | grep akvo
981 MB  akvo-postgis
2.36 GB akvo-tiler
267 MB  akvo-nginx-secured
351 MB  akvo-varnish
227 MB  akvo-redis
224 MB  akvo-base
```

---

## What we have
### Scripts to build and run the system
 
- `make start` starts and connect all containers

--

```
$ make start
...
$ docker ps  | grep akvo
...   akvo-nginx-secured   "/usr/local/openre..."   ... 
...   akvo-varnish         "/start.sh"              ...
...   akvo-tiler           "/bin/sh -c 'cd /t..."   ...
...   akvo-redis           "/usr/bin/redis-se..."   ...
...   akvo-postgis         "/bin/sh -c 'su po..."   ...
```

---

## What we have
### Scripts to build and run the system
 
- `make stop` stops all containers
- `make restart` stops and start all containers
- `make <name>-logs` shows logs for a given container (eg. `make tiler-logs`)

---

## What we have
### Scripts to build and run the system

Schema of running system:

```
      [ redis ]
          ⇅
      [ tiler ]  ⇄  [ varnish ] ⇄ [ nginx-secured ]
          ↓                                    
     [ postgis ]                                       
```

---

## What we have
### Scripts to build and run the system

Schema of running system:

```
      [ redis ]
          ⇅
      [ tiler ]  ⇄  [ varnish ] ⇄ [ nginx-secured ]
          ↓                                 ⇅
     [ postgis ]                       (( viewer ))
```

---

## What we have
### Scripts to build and run the system

Schema of running system (how it should probably be):

```
      [ redis ]
          ⇅
      [ tiler ]  ⇄  [ nginx-secured ] ⇄ [ varnish ]
          ↓                                 ⇅
     [ postgis ]                       (( viewer ))
```

???

Content Delivery Network could be used for tiles fetching.

---

## What we have
### Viewer

- `viewer/index.html`

--

- [Leaflet](http://leafletjs.com/) based

.center[![Leaflet logo](http://leafletjs.com/docs/images/logo.png)]

--

- `make start` prints a `file://` link for you to follow ("Now visit: ...")

---

## What we have - Viewer

- This is what you see in the page

.center[![Viewer input](http://strk.kbt.io/tmp/akvo-viewer.png)]

---

## What we have - Viewer

- `Base URL` is the MapService API endpoint

.center[![Viewer input](http://strk.kbt.io/tmp/akvo-viewer.png)]

--

- First path compoment is database name (`akvo` in this case)
--

- `layergroup` is an hardcoded path that could be changed in code
--

- Host is the `nginx-secured` container IP, can be changed
  to debug other layers (varnish or Tiler)

---

## What we have - Viewer

- `Auth token` is a JSON Web Token

.center[![Viewer input](http://strk.kbt.io/tmp/akvo-viewer.png)]

--

- Needed when targetting `nginx-secured` layer (the default)
--

- Can be obtained with the `util/get_token.sh` script
--

- Verified by `nginx-secured` against AKVO Keycloack

---

## What we have - Viewer

- `MapConfig` is the map configuration

.center[![Viewer input](http://strk.kbt.io/tmp/akvo-viewer.png)]

--

- Handled by Windshaft, which hosts [specs](https://github.com/CartoDB/Windshaft/blob/master/doc/MapConfig-specification.md)
--

- Allows using arbitrary SQL queries as datasources
--

- Lets you define styles in [CartoCSS](https://www.mapbox.com/help/getting-started-cartocss/)


---

## What we have - Viewer

--

- `Go` button will `POST` the MapConfig with an `Authorization` header
--

- The tiler will respond with a `map token`
--

- The client will ask for tiles using the `map token`

--

.center[![Viewer output](http://strk.kbt.io/tmp/mapview.png)]

---

# More on the tiler

## State

--

- Holds no permanent state
--

- Expiration times are configurable

--
- Caches are kept-alive by usage

---

# More on the tiler

## Cache: Map Store

- Full MapConfig by id (hash) stored in Redis
--

    - Kept alive by serving map tiles or attributes
--
    - Kept alive by requesting the same MapConfig again
--
    - Configurable expiration time
```
    // server/http/server.js:78
    var map_store  = new windshaft.storage.MapStore({
        ...
        expire_time: opts.grainstore.default_layergroup_ttl
    });
```

---

# More on the tiler

## Cache: Renderer

- Initialized renderer and associated "meta-tiles" in tiler memory
--

    - Kept alive by serving map tiles or attributes for the specific map
--
    - Reset by detected data update (`cache_buster`)
--
    - Kept alive by requesting the same MapConfig again
--
    - Configurable expiration time
```
    // server/http/server.js:96
    var rendererCacheOpts = {
        ttl: 60000 // 60 seconds
    };
    var rendererCache = new windshaft.cache.RendererCache(
      rendererFactory, rendererCacheOpts);
```

???

This is a proof of concept implementation so configuration of these
parameters are not straightforward. But it's possible to clean that
part up by using the `global.environment` object, which contains
what's being found in `config/environment/development.js`

---

# More on the tiler

## API

--
- https://github.com/CartoDB/Windshaft/blob/master/doc/Multilayer-API.md

--
- Client sends MapConfig and obtains a MapToken

--
- Client uses MapToken to request further resources:

--
    - PNG tiles (with PostGIS Geometry or Raster inputs)
--
    - UTF8 grids (for mouse over event handling, receiving feature id)
--
    - Torque tiles
--
    - Attributes (by feature id)
--
- Data changed events are expected to be checked by clients
  (for example by polling)

???

An additional API could be exposed by the server to do just data-update
checking (and keeping the caches alive at the same time).

---

# ~ The End ~

## Questions welcome

### And issues:

#### https://github.com/akvo/akvo-maps/issues
