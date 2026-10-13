require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const ROOT = path.join(__dirname, '..', 'uploads');
const STORAGE_URL = process.env.STORAGE_UPLOAD_URL;
const STORAGE_KEY = process.env.STORAGE_UPLOAD_KEY;

if (!STORAGE_URL || !STORAGE_KEY) {
  console.error('Missing STORAGE_UPLOAD_URL or STORAGE_UPLOAD_KEY in .env');
  process.exit(1);
}

const FOLDER_MAP = {
  'profile-pics': 'profile/legacy',
  documents: 'documents/legacy',
  posts: 'posts/legacy',
  chat: 'chat/legacy',
  attendance: 'attendance/legacy',
};

const walk = (dir) => {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
};

const uploadFile = async (filePath, folder) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  if (folder) form.append('folder', folder);

  const res = await axios.post(STORAGE_URL, form, {
    headers: {
      ...form.getHeaders(),
      'X-Upload-Key': STORAGE_KEY,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return res?.data?.url || null;
};

const main = async () => {
  const files = walk(ROOT);
  if (files.length === 0) {
    console.log('No files found in backend/uploads');
    return;
  }

  const map = {};
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const top = rel.split('/')[0];
    const folder = FOLDER_MAP[top] || `misc/${top}`;

    try {
      const url = await uploadFile(file, folder);
      if (!url) {
        console.warn('Upload failed:', rel);
        continue;
      }
      map[rel] = url;
      console.log('Uploaded:', rel, '->', url);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      console.error('Error uploading', rel, msg);
    }
  }

  const outPath = path.join(__dirname, 'migration-map.json');
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log('Mapping saved to', outPath);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
