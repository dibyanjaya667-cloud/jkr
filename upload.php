<?php

require __DIR__ . '/bootstrap.php';

storageAllowOrigin($config);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: X-Upload-Key, Content-Type');
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  storageJson(405, ['error' => 'Method not allowed']);
}

storageRequireKey($config);
if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
  storageJson(400, ['error' => 'File missing']);
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
  storageJson(400, ['error' => 'Upload error']);
}
if (!is_uploaded_file($file['tmp_name']) || $file['size'] > $config['max_size']) {
  storageJson(413, ['error' => 'File is too large']);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$extension = $config['allowed_mime'][$mime] ?? null;
if ($extension === null) {
  storageJson(415, ['error' => 'Unsupported file type']);
}

$requestedFolder = (string) ($_POST['folder'] ?? 'general');
$safeFolder = trim(preg_replace('/[^a-zA-Z0-9_\/-]/', '', $requestedFolder), '/');
if ($safeFolder === '') {
  $safeFolder = 'general';
}

$relativeFolder = $safeFolder . '/' . gmdate('Y-m-d');
$targetDirectory = $config['upload_dir'] . '/' . $relativeFolder;
if (!is_dir($targetDirectory)) {
  @mkdir($targetDirectory, 0755, true);
  clearstatcache(true, $targetDirectory);
}
if (!is_dir($targetDirectory)) {
  storageJson(500, ['error' => 'Upload directory is unavailable']);
}

try {
  $filename = bin2hex(random_bytes(16)) . '.' . $extension;
} catch (Throwable $error) {
  storageJson(500, ['error' => 'Could not generate file name']);
}

$targetPath = $targetDirectory . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
  storageJson(500, ['error' => 'Could not save file']);
}

$relativePath = 'uploads/' . $relativeFolder . '/' . $filename;
$baseUrl = $config['base_url'];
if ($baseUrl === '') {
  @unlink($targetPath);
  storageJson(500, ['error' => 'Storage base URL is not configured']);
}
$url = $baseUrl . '/' . $relativePath;

try {
  logStorageUpload($config, [
    'path' => $relativePath,
    'url' => $url,
    'mime' => $mime,
    'size' => (int) $file['size'],
    'uploaderIp' => $_SERVER['REMOTE_ADDR'] ?? '',
    'metadata' => json_encode(['userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? '']),
  ]);
} catch (Throwable $error) {
  error_log('Storage upload logging failed: ' . $error->getMessage());
}

storageJson(201, [
  'url' => $url,
  'path' => $relativePath,
  'mime' => $mime,
  'size' => (int) $file['size'],
]);
