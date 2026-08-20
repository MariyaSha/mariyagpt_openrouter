#!/bin/bash
set -e

PGDATA=/var/lib/postgresql/data
PGBIN=/usr/lib/postgresql/17/bin

mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL..."

    su postgres -c "$PGBIN/initdb -D $PGDATA"

    su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1' -w start"

    su postgres -c "$PGBIN/psql -c \"CREATE ROLE mariyagpt WITH LOGIN PASSWORD 'mariyagpt_local';\""

    su postgres -c "$PGBIN/createdb -O mariyagpt mariyagpt"

    PGPASSWORD=mariyagpt_local \
    psql \
        -h 127.0.0.1 \
        -U mariyagpt \
        -d mariyagpt \
        -f /app/database/schema.sql

    su postgres -c "$PGBIN/pg_ctl -D $PGDATA -m fast -w stop"
fi

echo "Starting PostgreSQL..."

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf