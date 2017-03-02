# AKVO MapService


 - What we have

 - How to use

---

## What we have

 - A bunch of Docker images (`images/`)

--

 - A set of Makefiles to build all images and run the system  (`*/Makefile`)

--

 - An example service client (`viewer/`)

---

## What we have
### Docker images

 - Database (`akvo-postgis`)

--

 - Key-value store (`akvo-redis`)

--

 - Tiler (`akvo-tiler`)

--

 - Authentication layer (`akvo-nginx-secured`) 

--

 - Shared clients cache (`akvo-varnish`)
 
???

All but "nginx" based on a "base" image images/base/Dockerfile

---

## What we have - Docker images
### Database (`akvo-postgis`)

- `images/postgis/Dockerfile`
- PostgreSQL server (9.5)
- [PostGIS](http://postgis.net) extension (2.2)
- Example spatial database with preloaded data (liberia points)

.center[![PostGISLogo](https://upload.wikimedia.org/wikipedia/en/6/60/PostGIS_logo.png)]

---

## What we have - Docker images
### Key-value store (`akvo-redis`)

- `images/redis/Dockerfile`
- [Redis](https://redis.io/) server (3.0)
- Used by the Tiler to store map configurations

.center[![RedisLogo](https://chrysohous.files.wordpress.com/2012/08/redis.png)]

---

## What we have - Docker images
### Tiler (`akvo-tiler`)

- `images/tiler/Dockerfile`
- Based on [Windhsaft](https://github.com/CartoDB/Windshaft)
- Custom fork for SRID patch
- Configurable API endpoints

.center[![SampleTile](https://raw.githubusercontent.com/CartoDB/Windshaft/master/examples/images/screen_3.png)]

???

- Uses Mapnik renderer to create tiles from PostGIS data (both vector and raster)
- Can also serve record attributes directly querying PostgreSQL
- Only state is the map configuration (in redis), expiring when unused

---

## What we have - Docker images
### Authentication layer (`akvo-nginx-secured`)

- `images/nginx-secured/Dockerfile`
- Based on [OpenResty](https://openresty.org) (NGINX + LUA)
- JWT verification to allow POSTs (used to create maps)
- Proxies to underlying tiler

.center[![OpenResty Logo](http://openresty.org/images/logo.png)]

---

## What we have - Docker images
### Shared clients cache (`akvo-varnish`)


- `images/varnish/Dockerfile`
- [Varnish](https://www.varnish-cache.org) HTTP cache (4.1)
- Never-invalidated cache for tile users

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

---

## What we have
### Viewer (TODO)
