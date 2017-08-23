#!/usr/bin/env bash

set -eu

BRANCH_NAME="${TRAVIS_BRANCH:=unknown}"

cd windshaft

docker build -t "${DOCKER_IMAGE_NAME:=akvo/akvo-maps}" .

cd ..