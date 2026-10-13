<?php

$config = require __DIR__ . '/config.php';
require __DIR__ . '/db.php';

function storageJson(int $status, array $body): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($body, JSON_UNESCAPED_SLASHES);
  exit;
}

function storageAllowOrigin(array $config): void {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin !== '' && in_array($origin, $config['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
  }
}

function storageRequireKey(array $config): void {
  $providedKey = $_SERVER['HTTP_X_UPLOAD_KEY'] ?? '';
  $expectedKey = $config['upload_key'];
  if ($expectedKey === '' || !hash_equals($expectedKey, $providedKey)) {
    storageJson(401, ['error' => 'Unauthorized']);
  }
}

function storageRelativePath(string $path): string {
  $path = str_replace('\\', '/', $path);
  $path = ltrim($path, '/');
  if ($path === '' || str_contains($path, '..') || !str_starts_with($path, 'uploads/')) {
    storageJson(400, ['error' => 'Invalid file path']);
  }
  return $path;
}
