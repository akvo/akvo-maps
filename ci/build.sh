#!/usr/bin/env bash

set -e

BRANCH_NAME="${TRAVIS_BRANCH:=unknown}"

if [ -z "$TRAVIS_COMMIT" ]; then
    export TRAVIS_COMMIT=local
fi

cd windshaft

IMAGE_TAG=$(echo -n "${TRAVIS_COMMIT}" | cut -c-8)
IMAGE_NAME="akvo/akvo-maps:${IMAGE_TAG}"
export IMAGE_TAG="${IMAGE_TAG}"

docker build -t "${DOCKER_IMAGE_NAME:=$IMAGE_NAME}" .

cd ..

docker build -t "akvo/akvo-maps-statsd-to-prometheus:${IMAGE_TAG}" statsd-to-prometheus

docker-compose -f docker-compose-ci.yml up -d --build
docker-compose -f docker-compose-ci.yml run tests /tests/import-and-run.sh test
rc=$?

docker-compose -f docker-compose-ci.yml down
exit $rc
