FROM akvo/akvo-lumen-db:20181023.8084497

COPY ./provision/helpers/* /docker-entrypoint-initdb.d/helpers/
COPY ./provision/setup.sh /docker-entrypoint-initdb.d/999-setup.sh
