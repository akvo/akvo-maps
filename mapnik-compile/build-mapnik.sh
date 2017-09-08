#!/usr/bin/env bash

set -eu

MAPNIK_NODE_VERSION=`node -e "console.log(require('./package.json').version)"`
MAPNIK_VERSION=`grep "install mapnik" install_mason.sh | tr -s " " | cut -f 4 -d\ `

if [ -z "$MAPNIK_VERSION" ]; then
    echo "Could not find MAPNIK_VERSION"
    exit 1
fi

sed -i 's/install mapnik.*//' install_mason.sh

cat >> install_mason.sh <<EOF
# Build libpq with ssl support.
## mason does not have a way of just downloading a dependency, so we install libpq, enable ssl and rebuild it again.
## libpq version should be extracted from mapnik dependencies somehow
./mason/mason install libpq 9.6.2
sed -i 's/without-openssl/with-openssl/' mason/scripts/libpq/9.6.2/script.sh
## This was required at some point. Doesnt seem to be the case for tag 3.6.2
#### pushd mason_packages/.build/postgresql-9.6.2/src/interfaces/libpq
#### make clean
#### popd
sed -i 's/without-openssl/with-openssl/' mason/scripts/libpq/9.6.2/script.sh
./mason/mason build libpq 9.6.2
./mason/mason link libpq 9.6.2

## mason does not have a way of just downloading a dependency, so we build install and rebuild.
./mason/mason install mapnik $MAPNIK_VERSION
./mason/mason build mapnik $MAPNIK_VERSION
./mason/mason link mapnik $MAPNIK_VERSION
EOF

make


# Build packages
./node_modules/.bin/node-pre-gyp package
mkdir -p final/mapnik
tar zxf `find -iname "*Release.tar.gz"` -C final
make clean
make distclean
npm pack
tar zxf mapnik*tgz -C final

## Build final artifact
cd final
mkdir -p mapnik/lib/binding/
cp -rf binding/lib mapnik/lib/binding/
cp -r binding/lib/* mapnik/lib/binding/
cp -r binding/share/* mapnik/lib/binding/
cp binding/mapnik.node mapnik/lib/binding/
cp binding/mapnik_settings.js mapnik/lib/binding/
cp binding/bin/* mapnik/lib/binding/
cp -R package/* mapnik/
rm -rf mapnik/final

#cp package.json mapnik
tar czvf mapnik-$MAPNIK_NODE_VERSION-linux-x64.tgz mapnik
