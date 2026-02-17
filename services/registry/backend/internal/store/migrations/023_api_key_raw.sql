-- Store raw API key so it can be retrieved from the dashboard.
ALTER TABLE api_keys ADD COLUMN key_raw TEXT;
