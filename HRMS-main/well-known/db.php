<?php
$config = require __DIR__ . '/config.php';

function getDbConnection() {
  $cfg = (require __DIR__ . '/config.php');
  if (empty($cfg['db']['enabled'])) return null;

  $host = $cfg['db']['host'];
  $user = $cfg['db']['user'];
  $pass = $cfg['db']['pass'];
  $name = $cfg['db']['name'];

  $mysqli = new mysqli($host, $user, $pass, $name);
  if ($mysqli->connect_error) {
    throw new Exception('DB connection failed: ' . $mysqli->connect_error);
  }
  $mysqli->set_charset('utf8mb4');
  return $mysqli;
}

function logUpload($row) {
  $db = getDbConnection();
  if (!$db) return;

  $stmt = $db->prepare(
    'INSERT INTO uploads (filename, url, mime, size_bytes, uploader, meta) VALUES (?, ?, ?, ?, ?, ?)'
  );

  $filename = $row['filename'] ?? '';
  $url = $row['url'] ?? '';
  $mime = $row['mime'] ?? '';
  $size = $row['size'] ?? 0;
  $uploader = $row['uploader'] ?? '';
  $meta = $row['meta'] ?? '';

  $stmt->bind_param('sssiss', $filename, $url, $mime, $size, $uploader, $meta);
  $stmt->execute();
  $stmt->close();
  $db->close();
}
