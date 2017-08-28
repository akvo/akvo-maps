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

EXPOSE 4000
ENV NODE_ENV production

#RUN useradd --user-group --create-home --shell /bin/false app
#ENV HOME=/home/app
#USER app
#WORKDIR $HOME/tiler

COPY server/package.json server/npm-shrinkwrap.json /tiler/
RUN cd /tiler && npm install

COPY server /tiler
CMD cd /tiler && chmod u+x ./run.sh && ./run.sh