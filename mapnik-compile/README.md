This is a Docker image that is able to compile [node-mapnik](https://github.com/mapnik/node-mapnik/) >= 3.6 
with a SSL enabled Postgres client library (libpq).

It does so by first compiling libpq with *--with-openssl*, then mapnik against it and finally node-mapnik.
 
We are patching the node-mapnik build process and packaging the result manually, so the process is expected to break
with future versions of node-mapnik. See *build-mapnik.sh* 

node-mapnik pre 3.6 did not use [mason](https://github.com/mapbox/mason) to manage dependencies, so the patching that 
we are doing does not work on those versions. 

It happens that the Windshaft version that we are using depends on node-mapnik 3.5, but testing against the 3.6 version 
that we produce seems to work. 

Note that node-mapnik 3.5 depends on mapnik 3.0.12 while node-mapnik 3.6 depends on 3.0.15, so the underlying library
has not changed that much.

## Build

Run the *create.sh* script. This will generate the package and copy it to your local folder. 

## Updating node-mapnik version

1. Change git checkout on Dockerfile to the desired version
1. Change the *create.sh* cp command
1. Upload the mapnik-*-tar.gz to S3. We are using /akvoflow/npm. Make sure the file is public.
1. Update npm shrinkwrap
    1. Update *windshaft/server/package.json* with the new S3 url
    1. Start the dev environment. The Windshaft processes will probably crash. Don't worry.
    1. *docker exec -i -t akvomaps_windshaft2_1 /bin/bash*
   ```
    cd /tiler
    rm -rf /tiler/node_modules/*
    rm -rf /tiler/npm-shrinkwrap.json
    npm install
    npm shrinkwrap
    ```
    1. Stop env
1. In the generated npm-shrinkwrap.json, override any dependency to mapnik to our S3 url. See the diff to know how.
