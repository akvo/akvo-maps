FROM akvo-base

RUN apt-get update && apt-get -y install \
  postgis curl gdal-bin && apt-get clean

EXPOSE 5432

# Enable connecting from the outside
RUN echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/9.5/main/pg_hba.conf
RUN echo "listen_addresses = '*'" >> /etc/postgresql/9.5/main/postgresql.conf

RUN service postgresql start && \
    # Create a template_gis database \
    echo "CREATE DATABASE template_gis TEMPLATE template0 ENCODING UTF8;" | su postgres -c psql && \
    echo "CREATE EXTENSION postgis;" | PGDATABASE=template_gis su postgres -c psql && \
    # Create an akvo user \
    echo "CREATE USER akvo WITH PASSWORD 'akvo';" | su postgres -c psql && \
    # Create an akvo database owned by akvo \
    echo "CREATE DATABASE akvo TEMPLATE template_gis OWNER 'akvo';" | su postgres -c psql

# Set default access parameters
ENV PGUSER akvo
ENV PGPASSWORD akvo
ENV PGDATABASE akvo
ENV PGHOST localhost

# Import sample data
ADD data /data
RUN service postgresql start && \
    sleep 10 && \
    sh -c "/data/import_csv.sh /data/liberia.csv | psql"; \
    echo "SELECT AddGeometryColumn('liberia', 'geom', 4326, 'point', 2);" \
         "UPDATE liberia SET geom = " \
         "  ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)" \
         " WHERE longitude != '' and latitude != '';" \
         "CREATE INDEX ON liberia USING GIST (geom);" \
         | psql --set ON_ERROR_STOP=1

# Start backend
CMD su postgres -c sh -c "/usr/lib/postgresql/9.5/bin/postgres -D /var/lib/postgresql/9.5/main/ -c config_file=/etc/postgresql/9.5/main/postgresql.conf"
