import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from '@bixbyte/capacitor-apk-installer';
import { Capacitor } from '@capacitor/core';

export const DownloadManager = {

  /**
   * Helper to convert Google Drive links to direct download links
   */
  getDirectLink: (url) => {
    if (url && url.includes('drive.google.com')) {
      const idMatch = url.match(/\/d\/([^/]+)/);
      if (idMatch) {
        return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
      }
      // fallback for older format
      const idMatch2 = url.match(/[-\w]{25,}/);
      if (idMatch2) {
        return `https://drive.google.com/uc?export=download&id=${idMatch2[0]}`;
      }
    }
    return url;
  },

  /**
   * WEB (Desktop/Laptop): Download using browser Fetch + Blob
   */
  downloadFileWeb: async (url, fileName, onProgress) => {
    const directUrl = DownloadManager.getDirectLink(url);

    const response = await fetch(directUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (total > 0) {
        onProgress(Math.round((loaded / total) * 100));
      }
    }

    // Merge all chunks into a single Blob
    const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
    const blobUrl = URL.createObjectURL(blob);

    // Trigger browser download
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    onProgress(100);
    return blobUrl;
  },

  /**
   * WEB (Desktop/Laptop): Download chunked file using browser Fetch + Blob
   */
  downloadChunkedFileWeb: async (urlBase, chunkCount, fileName, onProgress) => {
    const allChunks = [];

    for (let i = 0; i < chunkCount; i++) {
      const chunkUrl = `${urlBase}_part_${i}`;
      const response = await fetch(chunkUrl);
      if (!response.ok) throw new Error(`Chunk ${i} download failed: ${response.statusText}`);

      const buffer = await response.arrayBuffer();
      allChunks.push(new Uint8Array(buffer));

      const progress = Math.round(((i + 1) / chunkCount) * 100);
      onProgress(progress);
    }

    // Merge all chunks into one Blob
    const blob = new Blob(allChunks, { type: 'application/vnd.android.package-archive' });
    const blobUrl = URL.createObjectURL(blob);

    // Trigger browser download
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return blobUrl;
  },

  /**
   * Main download function — auto-detects platform
   */
  downloadFile: async (url, fileName, onProgress) => {
    // WEB (Desktop/Laptop browser)
    if (Capacitor.getPlatform() === 'web') {
      return await DownloadManager.downloadFileWeb(url, fileName, onProgress);
    }

    // ANDROID / iOS — Capacitor Filesystem
    try {
      const directUrl = DownloadManager.getDirectLink(url);
      const folderPath = 'Download/cstore';
      const fullPath = `${folderPath}/${fileName}`;
      
      try {
        await Filesystem.mkdir({
          path: folderPath,
          directory: Directory.ExternalStorage,
          recursive: true
        });
      } catch (e) {}

      await Filesystem.removeAllListeners();
      await Filesystem.addListener('progress', (progress) => {
        if (progress.bytes && progress.contentLength) {
          const percent = Math.round((progress.bytes / progress.contentLength) * 100);
          onProgress(percent);
        }
      });

      const downloadResult = await Filesystem.downloadFile({
        url: directUrl,
        path: fullPath,
        directory: Directory.ExternalStorage
      });

      await new Promise(r => setTimeout(r, 1000));
      
      const stat = await Filesystem.stat({
        path: fullPath,
        directory: Directory.ExternalStorage
      });

      if (stat.size < 100000) {
        throw new Error('DOWNLOAD_BLOCKED');
      }
      
      return downloadResult.path;
    } catch (error) {
      console.error('Download Manager Error:', error);
      throw error;
    }
  },

  /**
   * Main chunked download — auto-detects platform
   */
  downloadChunkedFile: async (urlBase, chunkCount, fileName, onProgress) => {
    // WEB (Desktop/Laptop browser)
    if (Capacitor.getPlatform() === 'web') {
      return await DownloadManager.downloadChunkedFileWeb(urlBase, chunkCount, fileName, onProgress);
    }

    // ANDROID / iOS — Capacitor Filesystem
    const folderPath = 'Download/cstore';
    const finalPath = `${folderPath}/${fileName}`;
    const tempFolder = `${folderPath}/temp`;

    console.log(`Starting chunked download for ${fileName}. Total chunks: ${chunkCount}`);

    try {
      await Filesystem.mkdir({ path: folderPath, directory: Directory.ExternalStorage, recursive: true }).catch(() => {});
      await Filesystem.mkdir({ path: tempFolder, directory: Directory.ExternalStorage, recursive: true }).catch(() => {});
      await Filesystem.deleteFile({ path: finalPath, directory: Directory.ExternalStorage }).catch(() => {});

      for (let i = 0; i < chunkCount; i++) {
        const chunkUrl = `${urlBase}_part_${i}`;
        const tempChunkPath = `${tempFolder}/part_${i}.tmp`;
        
        console.log(`Downloading chunk ${i + 1}/${chunkCount}...`);
        
        await Filesystem.downloadFile({
          url: chunkUrl,
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        const chunkStat = await Filesystem.stat({
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        if (chunkStat.size === 0) {
          throw new Error(`Chunk ${i} is empty. Download failed.`);
        }

        // Read as Base64 and append
        const chunkData = await Filesystem.readFile({
          path: tempChunkPath,
          directory: Directory.ExternalStorage,
          encoding: null  // binary → returns base64
        });

        await Filesystem.appendFile({
          path: finalPath,
          data: chunkData.data,
          directory: Directory.ExternalStorage
        });

        await Filesystem.deleteFile({
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        onProgress(Math.round(((i + 1) / chunkCount) * 100));
        await new Promise(r => setTimeout(r, 200));
      }

      const stat = await Filesystem.stat({ path: finalPath, directory: Directory.ExternalStorage });
      console.log(`Download complete. Final file size: ${stat.size} bytes`);
      
      return stat.uri || stat.path;
    } catch (error) {
      console.error('Chunked Download Failed:', error);
      throw error;
    }
  },

  /**
   * Triggers the APK installation process (Android only)
   */
  installApk: async (fileUri) => {
    if (Capacitor.getPlatform() !== 'android') {
      console.warn('APK installation is only supported on Android.');
      return;
    }

    try {
      const { hasPermission } = await ApkInstaller.checkInstallPermission();
      if (!hasPermission) {
        await ApkInstaller.requestInstallPermission();
      }
      const path = fileUri.replace('file://', '');
      await ApkInstaller.installApk({ filePath: path });
    } catch (error) {
      console.error('Installation failed:', error);
      throw error;
    }
  }
};
