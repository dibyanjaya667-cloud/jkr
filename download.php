<?php

require __DIR__ . '/bootstrap.php';

storageRequireKey($config);
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  storageJson(405, ['error' => 'Method not allowed']);
}

$relativePath = storageRelativePath((string) ($_GET['path'] ?? ''));
$absolutePath = __DIR__ . '/' . $relativePath;
$uploadsRoot = realpath($config['upload_dir']);
$filePath = realpath($absolutePath);

if ($uploadsRoot === false || $filePath === false || !str_starts_with($filePath, $uploadsRoot . DIRECTORY_SEPARATOR) || !is_file($filePath)) {
  storageJson(404, ['error' => 'File not found']);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
header('Content-Type: ' . $finfo->file($filePath));
header('Content-Length: ' . (string) filesize($filePath));
header('X-Content-Type-Options: nosniff');
readfile($filePath);
