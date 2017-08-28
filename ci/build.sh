#!/usr/bin/env bash

set -eu

BRANCH_NAME="${TRAVIS_BRANCH:=unknown}"

cd windshaft

IMAGE_NAME="akvo/akvo-maps:${TRAVIS_JOB_NUMBER:=none}"

docker build -t "${DOCKER_IMAGE_NAME:=$IMAGE_NAME}" .

cd ..

docker-compose -f docker-compose-ci.yml -d
docker-compose -f docker-compose-ci.yml run tests lein test
rc=$?
docker-compose -f docker-compose-ci.yml down
exit $rc