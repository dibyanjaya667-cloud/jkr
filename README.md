# HRMS Storage V2

Deploy the contents of this directory to the document root of `new.jkrbim.com`.

## Server setup

1. In cPanel, copy `config.local.php.example` to `config.local.php`.
2. Set `STORAGE_BASE_URL` to the final HTTPS subdomain URL.
3. Set a new long random `STORAGE_UPLOAD_KEY`.
4. Set the new cPanel database user to `jkrbidpi_newwwwww`, its actual cPanel password, and database name `jkrbidpi_newwwwww`.
5. Import `init.sql` into that database using phpMyAdmin.
6. Ensure the PHP process can create and write to the `uploads/` directory.

## HRMS backend environment

Set these values in the live backend environment, then redeploy it:

```text
STORAGE_UPLOAD_URL=https://new.jkrbim.com/upload.php
STORAGE_BASE_URL=https://new.jkrbim.com
STORAGE_UPLOAD_KEY=<the same random key from config.local.php>
```

Do not commit `config.local.php` or put the database password in browser code. The Node backend calls `upload.php` server-to-server; browsers never receive the storage key.

## Endpoints

- `POST /upload.php`: accepts `file` and optional `folder`, with `X-Upload-Key`.
- `GET /download.php?path=uploads/documents/...`: requires `X-Upload-Key`.# jkr
