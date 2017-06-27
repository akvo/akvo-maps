FROM akvo-base

# Install required packages

RUN apt-get update && apt-get install -y \
  build-essential \
  curl \
  git \
  libmapnik-dev \
  pkg-config \
  python-dev \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  g++

ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 6.9.5

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

# Build server

ADD server /tiler
RUN cd /tiler && rm -rf node_modules* && make

# Add config

ADD config /config

# Debugging mode on
ENV DEBUG windshaft*

# ENV variables (for some reason environment isn't working)
ENV PGHOST akvo-postgis
ENV PGUSER akvo
ENV PGPASSWORD akvo

# Start server
CMD cd /tiler && while :; do node server.js; sleep 10; done
