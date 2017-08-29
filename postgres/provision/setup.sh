#!/usr/bin/env bash

set -e

CLI_ERR_MSG="Postgres CLI tools not available (psql). Using Postgres.app, look
at http://postgresapp.com/documentation/cli-tools.html. Aborting."
hash psql 2>/dev/null || { echo >&2 $CLI_ERR_MSG ; exit 1; }

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $DIR


# Provision

psql -c "CREATE ROLE anybody WITH PASSWORD 'password' CREATEDB LOGIN;"

psql -f $DIR/helpers/create-a-database.sql

psql -d test_database -f $DIR/helpers/create-extensions.sql

sh -c "$DIR/helpers/import_csv.sh $DIR/helpers/liberia.csv | psql -d test_database";
echo "SELECT AddGeometryColumn('liberia', 'geom', 4326, 'point', 2);" \
     "UPDATE liberia SET geom = " \
     "  ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)" \
     " WHERE longitude != '' and latitude != '';" \
     "CREATE INDEX ON liberia USING GIST (geom);" \
     | psql --set ON_ERROR_STOP=1 -d test_database

echo "ALTER TABLE liberia OWNER TO anybody;" | psql -d test_database
echo "ALTER TABLE spatial_ref_sys OWNER TO anybody;" | psql -d test_database

echo ""
echo "----------"
echo "Done!!"
