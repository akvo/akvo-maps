#!/usr/bin/env bash

set -eu
set -o pipefail

apt-get update

apt-get install -y --no-install-recommends \
	build-essential \
	pkg-config \
	curl \
	ca-certificates \
	git \
	python \
	libz-dev \
	xutils-dev \
	libssl-dev

NODE_VERSION=10.16.3
GIT_BRANCH=v3.6.2-carto
GIT_TAG=v3.6.2-carto.16
NVM_DIR=/usr/local/nvm
export NVM_DIR

mkdir -p "${NVM_DIR}"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash

[ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"

nvm install "${NODE_VERSION}"

if [[ ! -d node-mapnik ]]; then
    git clone --depth=50 https://github.com/CartoDB/node-mapnik --branch "${GIT_BRANCH}"
fi

cd node-mapnik
git checkout -qf "${GIT_TAG}"

./scripts/setup.sh --config local.env

source local.env

if [ ! -f ./mason/mason.sh ]; then
    mkdir -p ./mason
    curl -sSfL https://github.com/CartoDB/mason/archive/master.tar.gz | tar --gunzip --extract --strip-components=1 --exclude="*md" --exclude="test*" --directory=./mason
fi

export CLANG_VERSION="5.0.0"
export PATH="$(./mason/mason prefix clang++ ${CLANG_VERSION})/bin:${PATH}"
export CXX="clang++"
export CC="clang"

export MAPNIK_VERSION="$(node -e "console.log(require('./package.json').mapnik_version)")"
export MASON_CARTO_VERSION="${MAPNIK_VERSION//v}"

# Rebuild dependencies

# Get library definition
./mason/mason install libpq 10.7

sed -i 's/--without-openssl/--with-openssl/' ./mason/scripts/libpq/10.7/script.sh

grep 'with-openssl' ./mason/scripts/libpq/10.7/script.sh

./mason/mason build libpq 10.7
./mason/mason link libpq 10.7

# Rebuild mapnik

./mason/mason build mapnik 3.0.15-carto
./mason/mason link mapnik 3.0.15-carto

make release

# Build should be standalone now, so remove mason deps
rm -rf mason_packages

make strip

./node_modules/.bin/node-pre-gyp package
