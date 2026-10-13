import { API_URL } from './api'

export const isStorageConfigured = () => true

const dataUrlToBlob = (dataUrl) => {
  const parts = dataUrl.split(',')
  if (parts.length < 2) return null
  const mimeMatch = parts[0].match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] || 'image/jpeg'
  const binary = atob(parts[1])
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export const uploadFileToStorage = async (file, folder) => {
  const form = new FormData()
  form.append('file', file)
  if (folder) {
    form.append('folder', folder)
  }

  const token = localStorage.getItem('token')
  const res = await fetch(`${API_URL}/storage/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.url) {
    throw new Error(json?.message || json?.error || 'Upload failed')
  }
  return json.url
}

export const uploadDataUrlToStorage = async (dataUrl, folder) => {
  const blob = dataUrlToBlob(dataUrl)
  if (!blob) throw new Error('Invalid image data')
  const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: blob.type })
  return uploadFileToStorage(file, folder)
}
