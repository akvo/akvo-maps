# ubuntu 16.04 / posgresql 9.5 / postgis 2.2

FROM ubuntu:xenial

RUN apt-get update && \
    apt-get install -yq \
    vim locales

RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8
