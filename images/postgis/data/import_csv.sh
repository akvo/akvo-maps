#!/bin/sh

INPUT=$1

test -z "$1" && {
  echo "Usage: $0 <csv>" >&2
  exit 1
}

FIELDS=`head -1 $INPUT | tr [A-Z] [a-z] |
  sed 's/ //g;s/\?//;s/^/"/;s/$/" varchar/;s/,/" varchar, "/g'`
TABLE=`basename $INPUT | sed 's/\.[^.]*//' | tr '[A-Z]' '[a-z]'`

echo "BEGIN;"
echo "CREATE TABLE \"${TABLE}\" ( ${FIELDS} );"
echo "COPY \"${TABLE}\" FROM stdin DELIMITER ',';"
tail -n +2 ${INPUT}
echo "\\."
echo "COMMIT;"

