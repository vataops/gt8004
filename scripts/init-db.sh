#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE ael_open;
    CREATE DATABASE ael_lite;
    CREATE DATABASE ael_unified;
EOSQL
