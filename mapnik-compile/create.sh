#!/usr/bin/env bash

docker build . -t mapnik-compile
docker run -it --name mapnik-compile mapnik-compile /node-mapnik/build-mapnik.sh
docker cp mapnik-compile:/node-mapnik/final/mapnik-3.6.2-linux-x64.tgz .
