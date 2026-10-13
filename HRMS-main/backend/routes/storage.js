const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const auth = require('../middleware/auth');

const router = express.Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/upload', auth, upload.single('file'), async (req, res) => {
	try {
		const storageUrl = process.env.STORAGE_UPLOAD_URL || 'https://cloud.jkrbim.com/upload.php';
		const storageKey = process.env.STORAGE_UPLOAD_KEY;

		if (!storageKey) {
			return res.status(500).json({ message: 'Storage upload key is not configured' });
		}

		if (!req.file) {
			return res.status(400).json({ message: 'No file uploaded' });
		}

		const form = new FormData();
		form.append('file', req.file.buffer, {
			filename: req.file.originalname || 'upload.jpg',
			contentType: req.file.mimetype || 'image/jpeg',
		});
		form.append('upload_key', storageKey);
		if (req.body?.folder) {
			form.append('folder', String(req.body.folder));
		}

		const response = await axios.post(storageUrl, form, {
			headers: {
				...form.getHeaders(),
				'X-Upload-Key': storageKey,
			},
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
			timeout: 30000,
		});

		const url = response?.data?.url;
		if (!url) {
			return res.status(502).json({ message: 'Storage provider returned no file URL' });
		}

		return res.json({ url });
	} catch (error) {
		const status = error.response?.status || 502;
		const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Storage upload failed';
		console.error('[Storage Upload] Failed:', status, message);
		return res.status(status).json({ message });
	}
});

router.get('/document', auth, async (req, res) => {
	try {
		const rawUrl = String(req.query.url || '');
		if (!rawUrl) {
			return res.status(400).json({ message: 'url is required' });
		}

		const storageBase = process.env.STORAGE_BASE_URL || 'https://cloud.jkrbim.com';
		const storageKey = process.env.STORAGE_UPLOAD_KEY;
		if (!storageKey) {
			return res.status(500).json({ message: 'Storage upload key is not configured' });
		}

		const parsed = new URL(rawUrl);
		const path = parsed.pathname.replace(/^\/+/, '');
		if (!path.startsWith('uploads/documents/')) {
			return res.status(400).json({ message: 'Invalid document path' });
		}

		const response = await axios.get(`${storageBase.replace(/\/$/, '')}/download.php`, {
			headers: { 'X-Upload-Key': storageKey },
			params: { path },
			responseType: 'stream',
			timeout: 30000,
		});

		res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
		if (response.headers['content-length']) {
			res.setHeader('Content-Length', response.headers['content-length']);
		}
		response.data.pipe(res);
	} catch (error) {
		const status = error.response?.status || 502;
		const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Document fetch failed';
		return res.status(status).json({ message });
	}
});

module.exports = router;
