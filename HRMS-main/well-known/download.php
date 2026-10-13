<?php
$config = require __DIR__ . '/config.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin) && in_array($origin, $config['allowed_origins'])) {
  header("Access-Control-Allow-Origin: $origin");
  header('Vary: Origin');
}

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  if (!empty($origin) && in_array($origin, $config['allowed_origins'])) {
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: X-Upload-Key, Content-Type');
  }
  http_response_code(204);
  exit;
}

$headerKey = $_SERVER['HTTP_X_UPLOAD_KEY'] ?? '';
if (!is_string($headerKey) || !hash_equals($config['upload_key'], $headerKey)) {
  header('Content-Type: application/json');
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

$path = $_GET['path'] ?? '';
if (!is_string($path) || $path === '') {
  header('Content-Type: application/json');
  http_response_code(400);
  echo json_encode(['error' => 'path is required']);
  exit;
}

$path = ltrim(str_replace('\\', '/', $path), '/');
if (strpos($path, '..') !== false || strpos($path, 'uploads/') !== 0) {
  header('Content-Type: application/json');
  http_response_code(400);
  echo json_encode(['error' => 'Invalid path']);
  exit;
}

$uploadDir = realpath($config['upload_dir']);
$relative = substr($path, strlen('uploads/'));
$fullPath = realpath($uploadDir . '/' . $relative);

// Ensure resolved path stays inside upload_dir (blocks path traversal)
if ($uploadDir === false || $fullPath === false || strpos($fullPath, $uploadDir) !== 0 || !is_file($fullPath)) {
  header('Content-Type: application/json');
  http_response_code(404);
  echo json_encode(['error' => 'File not found']);
  exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $fullPath) ?: 'application/octet-stream';
finfo_close($finfo);

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($fullPath));
header('Cache-Control: private, max-age=3600');
readfile($fullPath);
exit;
