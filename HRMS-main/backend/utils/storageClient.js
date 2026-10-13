const axios = require('axios');
const FormData = require('form-data');

const uploadBufferToStorage = async ({ buffer, filename, mimeType, folder }) => {
  const storageUrl = process.env.STORAGE_UPLOAD_URL;
  const storageKey = process.env.STORAGE_UPLOAD_KEY;

  if (!storageUrl || !storageKey) {
    return null;
  }

  const form = new FormData();
  form.append('file', buffer, {
    filename: filename || 'upload.jpg',
    contentType: mimeType || 'image/jpeg',
  });
  if (folder) {
    form.append('folder', folder);
  }

  const response = await axios.post(storageUrl, form, {
    headers: {
      ...form.getHeaders(),
      'X-Upload-Key': storageKey,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return response?.data?.url || null;
};

module.exports = {
  uploadBufferToStorage,
};
