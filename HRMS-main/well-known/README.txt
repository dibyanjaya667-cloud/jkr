PHP Image Storage (cPanel)

1) config.php
   - base_url, upload_key, allowed_origins set karo
   - DB details set karo (db.enabled=true)

2) Database
   - init.sql run karo

3) Upload
   - POST /upload.php (multipart/form-data)
   - field: file
   - header: X-Upload-Key: <your_secret>

Response:
{
  "success": true,
  "url": "https://your-domain.com/php-storage/uploads/YYYY-MM-DD/FILE.jpg"
}
