<?php
$config = require __DIR__ . '/config.php';
require __DIR__ . '/db.php';

header('Content-Type: application/json');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin) && in_array($origin, $config['allowed_origins'])) {
  header("Access-Control-Allow-Origin: $origin");
  header('Vary: Origin');
}

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  if (!empty($origin) && in_array($origin, $config['allowed_origins'])) {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: X-Upload-Key, Content-Type');
  }
  http_response_code(204);
  exit;
}

$headerKey = $_SERVER['HTTP_X_UPLOAD_KEY'] ?? '';
$formKey = $_POST['upload_key'] ?? '';
$headerIsValid = is_string($headerKey) && hash_equals($config['upload_key'], $headerKey);
$formIsValid = is_string($formKey) && hash_equals($config['upload_key'], $formKey);
if (!$headerIsValid && !$formIsValid) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

if (!isset($_FILES['file'])) {
  http_response_code(400);
  echo json_encode(['error' => 'File missing']);
  exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'Upload error']);
  exit;
}

if ($file['size'] > $config['max_size']) {
  http_response_code(413);
  echo json_encode(['error' => 'File too large']);
  exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $config['allowed_mime'])) {
  http_response_code(415);
  echo json_encode(['error' => 'Unsupported file type']);
  exit;
}

$ext = $mime === 'image/png' ? 'png' : ($mime === 'image/webp' ? 'webp' : 'jpg');
$requestedFolder = $_POST['folder'] ?? '';
$safeFolder = preg_replace('/[^a-zA-Z0-9_\/-]/', '', $requestedFolder);
$safeFolder = str_replace('..', '', $safeFolder);
$safeFolder = trim($safeFolder, '/');
$dateFolder = date('Y-m-d');
$folder = $safeFolder ? ($safeFolder . '/' . $dateFolder) : $dateFolder;
$targetDir = $config['upload_dir'] . '/' . $folder;

$filename = bin2hex(random_bytes(16)) . '.' . $ext;
$targetPath = $targetDir . '/' . $filename;
$savedToFallback = false;

clearstatcache(true, $targetDir);
if (!is_dir($targetDir)) {
  @mkdir($targetDir, 0755, true);
  clearstatcache(true, $targetDir);
}

if (!is_dir($targetDir) || !move_uploaded_file($file['tmp_name'], $targetPath)) {
  $fallbackFolder = 'failed-uploads/' . $dateFolder;
  $fallbackDir = __DIR__ . '/' . $fallbackFolder;
  $fallbackPath = $fallbackDir . '/' . $filename;

  clearstatcache(true, $fallbackDir);
  if (!is_dir($fallbackDir)) {
    @mkdir($fallbackDir, 0755, true);
    clearstatcache(true, $fallbackDir);
  }

  if (!is_dir($fallbackDir) || !copy($file['tmp_name'], $fallbackPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Primary and fallback upload storage failed']);
    exit;
  }

  @unlink($file['tmp_name']);
  $folder = $fallbackFolder;
  $targetPath = $fallbackPath;
  $savedToFallback = true;
}

$urlBase = rtrim($config['base_url'], '/');
$url = $savedToFallback
  ? $urlBase . '/' . $folder . '/' . $filename
  : $urlBase . '/uploads/' . $folder . '/' . $filename;

try {
  logUpload([
    'filename' => $filename,
    'url' => $url,
    'mime' => $mime,
    'size' => $file['size'],
    'uploader' => $_SERVER['REMOTE_ADDR'] ?? '',
    'meta' => json_encode([
      'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
      'origin' => $origin,
    ]),
  ]);
} catch (Exception $e) {
  // ignore DB logging errors
}

echo json_encode([
  'success' => true,
  'url' => $url,
  'mime' => $mime,
  'size' => $file['size'],
  'fallback' => $savedToFallback,
]);
