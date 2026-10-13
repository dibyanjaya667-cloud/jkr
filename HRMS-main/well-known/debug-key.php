<?php
// TEMPORARY DIAGNOSTIC FILE — DELETE FROM CPANEL AFTER USE.
// Never leave this file live on the server; it exists only to compare
// the configured upload_key against whatever key was actually received,
// without ever revealing either value in plain text.

$config = require __DIR__ . '/config.php';
header('Content-Type: application/json');

$headerKey = $_SERVER['HTTP_X_UPLOAD_KEY'] ?? '';
$formKey = $_POST['upload_key'] ?? '';
$configuredKey = $config['upload_key'] ?? '';

$hash = fn ($value) => $value === '' ? null : hash('sha256', $value);

echo json_encode([
  'configured_key_hash' => $hash($configuredKey),
  'configured_key_length' => strlen($configuredKey),
  'header_key_hash' => $hash($headerKey),
  'header_key_length' => strlen($headerKey),
  'header_key_matches_configured' => $headerKey !== '' && hash_equals($configuredKey, $headerKey),
  'form_key_hash' => $hash($formKey),
  'form_key_length' => strlen($formKey),
  'form_key_matches_configured' => $formKey !== '' && hash_equals($configuredKey, $formKey),
], JSON_PRETTY_PRINT);
