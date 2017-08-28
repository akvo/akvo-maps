#!/usr/bin/env bash

set -eu

BRANCH_NAME="${TRAVIS_BRANCH:=unknown}"

cd windshaft

IMAGE_NAME="akvo/akvo-maps:${TRAVIS_JOB_NUMBER:=none}"
IMAGE_NAME="akvo/akvo-maps"

docker build -t "${DOCKER_IMAGE_NAME:=akvo/akvo-maps}" .

cd ..

docker-compose -f docker-compose-ci.yml up -d
docker-compose -f docker-compose-ci.yml run tests lein test
rc=$?

docker-compose -f docker-compose-ci.yml down
exit $rc