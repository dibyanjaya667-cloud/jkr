<?php

$localConfigPath = __DIR__ . '/config.local.php';
$localConfig = is_file($localConfigPath) ? require $localConfigPath : [];

$get = static function (string $key, string $default = '') use ($localConfig): string {
  $value = $localConfig[$key] ?? getenv($key) ?: $default;
  return is_string($value) ? trim($value) : $default;
};

return [
  'base_url' => rtrim($get('STORAGE_BASE_URL'), '/'),
  'upload_dir' => __DIR__ . '/uploads',
  'max_size' => 15 * 1024 * 1024,
  'upload_key' => $get('STORAGE_UPLOAD_KEY'),
  'allowed_origins' => array_filter(array_map('trim', explode(',', $get('STORAGE_ALLOWED_ORIGINS')))),
  'allowed_mime' => [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
  ],
  'db' => [
    'host' => $get('STORAGE_DB_HOST', 'localhost'),
    'user' => $get('STORAGE_DB_USER'),
    'pass' => $get('STORAGE_DB_PASSWORD'),
    'name' => $get('STORAGE_DB_NAME'),
  ],
];
