import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from '@bixbyte/capacitor-apk-installer';
import { Capacitor } from '@capacitor/core';

export const DownloadManager = {

  /**
   * Helper to convert Google Drive links to direct download links
   */
  getDirectLink: (url) => {
    if (!url) return url;
    if (url.includes('drive.google.com')) {
      const idMatch = url.match(/\/d\/([^/]+)/);
      if (idMatch) {
        return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
      }
      const idMatch2 = url.match(/[-\w]{25,}/);
      if (idMatch2) {
        return `https://drive.google.com/uc?export=download&id=${idMatch2[0]}`;
      }
    }
    return url;
  },

  /**
   * WEB (Desktop/Laptop): Direct seamless in-page download
   * Never opens or closes blank tabs/windows! Fetches stream as Blob with real progress.
   */
  downloadFileWeb: async (url, fileName, onProgress) => {
    const directUrl = DownloadManager.getDirectLink(url);
    if (onProgress) onProgress(15);

    try {
      // 1. Fetch file as stream in the background without opening any page
      const response = await fetch(directUrl);
      if (!response.ok) throw new Error(`Download HTTP error: ${response.status}`);

      const contentLength = +response.headers.get('Content-Length') || 0;
      const reader = response.body.getReader();
      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;

        if (contentLength > 0 && onProgress) {
          const percent = Math.min(99, Math.round((receivedLength / contentLength) * 100));
          onProgress(percent);
        } else if (onProgress) {
          onProgress((prev) => Math.min(95, (prev || 20) + 12));
        }
      }

      // 2. Create in-memory Blob and trigger direct disk save
      const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      // Do NOT set target='_blank'! Blob download directly saves to disk without tabs!
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (onProgress) onProgress(100);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return blobUrl;
    } catch (err) {
      console.warn('In-page fetch blob failed (CORS or network), using seamless direct anchor fallback:', err);
      // Fallback: direct anchor without target="_blank"
      const a = document.createElement('a');
      a.href = directUrl;
      a.download = fileName;
      // Crucial: no target='_blank' to prevent opening/closing blank tabs!
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (onProgress) onProgress(100);
      return directUrl;
    }
  },

  /**
   * WEB (Desktop/Laptop): Parallel chunked download using Promise.all
   * Fetches chunks concurrently for maximum speed instead of slow serial loops!
   */
  downloadChunkedFileWeb: async (urlBase, chunkCount, fileName, onProgress) => {
    if (!chunkCount || chunkCount <= 1) {
      // If only 1 chunk or base URL, download directly
      return await DownloadManager.downloadFileWeb(`${urlBase}_part_0`, fileName, onProgress);
    }

    const allChunks = new Array(chunkCount);
    let completedChunks = 0;

    if (onProgress) onProgress(10);

    // Download chunks in parallel
    const fetchChunk = async (i) => {
      const chunkUrl = `${urlBase}_part_${i}`;
      const response = await fetch(chunkUrl);
      if (!response.ok) throw new Error(`Chunk ${i} failed: ${response.statusText}`);

      const buffer = await response.arrayBuffer();
      allChunks[i] = new Uint8Array(buffer);
      completedChunks++;
      if (onProgress) {
        onProgress(Math.min(95, Math.round((completedChunks / chunkCount) * 100)));
      }
    };

    const chunkPromises = [];
    for (let i = 0; i < chunkCount; i++) {
      chunkPromises.push(fetchChunk(i));
    }
    await Promise.all(chunkPromises);

    // Merge all chunks into single Blob
    const blob = new Blob(allChunks, { type: 'application/vnd.android.package-archive' });
    const blobUrl = URL.createObjectURL(blob);

    // Trigger instant browser download
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (onProgress) onProgress(100);
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
        if (progress.bytes && progress.contentLength && onProgress) {
          const percent = Math.round((progress.bytes / progress.contentLength) * 100);
          onProgress(percent);
        }
      });

      const downloadResult = await Filesystem.downloadFile({
        url: directUrl,
        path: fullPath,
        directory: Directory.ExternalStorage
      });

      const stat = await Filesystem.stat({
        path: fullPath,
        directory: Directory.ExternalStorage
      });

      if (stat.size < 1000) {
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

        // Read binary as base64 and append
        const chunkData = await Filesystem.readFile({
          path: tempChunkPath,
          directory: Directory.ExternalStorage,
          encoding: null
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

        if (onProgress) {
          onProgress(Math.round(((i + 1) / chunkCount) * 100));
        }
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
