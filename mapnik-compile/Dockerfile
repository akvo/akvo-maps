FROM ubuntu:xenial-20170802

# Install required packages

RUN apt-get update && \
  apt-get install -yq \
  locales \
  build-essential \
  git \
  curl \
  libmapnik-dev \
  pkg-config \
  python-dev \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  clang \
  libgif-dev \
  g++


RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 6.11.1

RUN curl -o- \
    https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh \
    | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN node --version
RUN npm --version

RUN npm install nodemon -g

ENV CC=clang CXX=clang++

WORKDIR /
RUN git clone https://github.com/mapnik/node-mapnik.git
WORKDIR /node-mapnik
RUN git checkout v3.6.2
RUN apt-get install -yq libssl-dev
COPY build-mapnik.sh /node-mapnik/build-mapnik.sh
RUN chmod 700 /node-mapnik/build-mapnik.sh

CMD ./build-mapnik.sh
