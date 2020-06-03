FROM ubuntu:xenial-20190904 as builder

# Build env
# Install required packages

RUN set -ex; apt-get update && \
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
    libgif-dev \
    g++ && \
    locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    NVM_DIR=/usr/local/nvm \
    NODE_VERSION=6.11.1

RUN set -e; curl -o- \
    https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh \
    | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules \
    PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

COPY server/package.json server/npm-shrinkwrap.json /tiler/

RUN npm install -g nodemon && \
    cd /tiler && npm install && npm dedup

# Execute environment

FROM ubuntu:xenial-20190904

RUN set -ex; apt-get update && \
    apt-get install -y \
    locales \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    ca-certificates && \
    locale-gen en_US.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    NVM_DIR=/usr/local/nvm \
    NODE_VERSION=6.11.1 \
    NODE_ENV=production \
    PGSSLMODE=verify-full \
    PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt

ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH \
    NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules

WORKDIR /tiler

COPY --from=builder $NVM_DIR $NVM_DIR

COPY --from=builder /tiler/node_modules ./node_modules

EXPOSE 4000

COPY server /tiler

RUN chmod u+x ./run.sh

CMD ["./run.sh"]
