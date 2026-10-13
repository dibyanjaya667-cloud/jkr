<?php
return [
  'app_name' => 'HRMS Image Storage',
  'base_url' => 'https://cloud.jkrbim.com',
  'upload_dir' => __DIR__ . '/uploads',
  'max_size' => 15 * 1024 * 1024, // 15MB
  'allowed_mime' => ['image/jpeg', 'image/png', 'image/webp'],
  'upload_key' => 'thisis_dibya_886866123456',
  'allowed_origins' => [
    'https://hrms-1-f8bu.onrender.com',
    'http://localhost:3000',
    'https://hrms-backend-jf7d.onrender.com',
     'https://hrms.jkrbim.com',
     'https://jkr-nwl0.onrender.com',
    'http://localhost:5000'
  ],
  'db' => [
    'enabled' => true,
    'host' => 'localhost',
    'user' => 'jkrbidpi_qwe',
    'pass' => 'jkrbidpi_qwe',
    'name' => 'jkrbidpi_qwe',
  ],
];
