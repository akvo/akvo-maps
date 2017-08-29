#!/usr/bin/env bash

set -e

BRANCH_NAME="${TRAVIS_BRANCH:=unknown}"

if [ -z "$TRAVIS_COMMIT" ]; then
    export TRAVIS_COMMIT=local
fi

cd windshaft

IMAGE_NAME="akvo/akvo-maps:${TRAVIS_COMMIT}"

docker build -t "${DOCKER_IMAGE_NAME:=$IMAGE_NAME}" .

cd ..

docker-compose -f docker-compose-ci.yml up -d
docker-compose -f docker-compose-ci.yml run tests lein test
rc=$?

docker-compose -f docker-compose-ci.yml down
exit $rc