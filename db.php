<?php

function storageDbConnection(array $config): ?mysqli {
  $db = $config['db'];
  if ($db['user'] === '' || $db['pass'] === '' || $db['name'] === '') {
    return null;
  }

  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
  $connection = new mysqli($db['host'], $db['user'], $db['pass'], $db['name']);
  $connection->set_charset('utf8mb4');
  return $connection;
}

function logStorageUpload(array $config, array $upload): void {
  $connection = storageDbConnection($config);
  if (!$connection) {
    return;
  }

  try {
    $statement = $connection->prepare(
      'INSERT INTO uploads (path, url, mime, size_bytes, uploader_ip, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $statement->bind_param(
      'sssiss',
      $upload['path'],
      $upload['url'],
      $upload['mime'],
      $upload['size'],
      $upload['uploaderIp'],
      $upload['metadata']
    );
    $statement->execute();
    $statement->close();
  } finally {
    $connection->close();
  }
}
