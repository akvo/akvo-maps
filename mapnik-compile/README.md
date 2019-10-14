We need to compile our own version because the upstream versions of
[mapnik](https://github.com/CartoDB/mapnik) and
[node-mapnik](https://github.com/CartoDB/node-mapnik) doesn't have SSL
support in the `libpq` library.

The build tool for this is [mason](https://github.com/CartoDB/mason/)
with package _recipies_ for several C/C++ libraries and programs.

As of this writing we're building the following versions:

* node-mapnik: v3.6.2-carto.16
* mapnik: v3.0.15.17 (v3.0.15 of upstream with some patches from CartoDB)


## Build

In order to build and test we setup an environment with PostGIS SSL required.
Then we build the components and test a connection to PostGIS.

    docker-compose up -d


This will start a _system_ with 2 containers. The `windshaft`
container is not doing anything just waiting. We execute `bash` and
run the compilation inside the container.


	docker-compose exec windshaft bash
	. mapnik-ssl-enabled.sh | tee "$(date +%s).log"

This will install the necessary dependencies, pull all the
repositories and recompile `mapnik` and `node-mapnik` with `libpq` and
SSL enabled.

A full compilation log is produced in your just machine
`<timestamp>.log`

## Test

There is a test in the test-suite of `node-mapnik` with a postgis
datasource definition that we can reuse.

Inside the `windshaft` container

    cp test-ssl.js node-mapnik/test
	cd node-mapnik
	patch -p1 < ../datasource.patch
	export NVM_DIR=/usr/local/nvm
	. $NVM_DIR/nvm.sh
	node test/test-ssl.js
	echo $?

The result of `echo $?` should be `0` (successful).

## Upload to S3

The resulting package is a compressed archive `tar.gz` located at

    node-mapnik/build/stage/mapnik/v3.6.2-carto.16/node-v64-linux-x64-Release.tar.gz

You can grab this archive and upload it to S3 into the `akvoflow`
bucket in the `npm` folder.
