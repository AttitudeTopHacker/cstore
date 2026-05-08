import axios from 'axios';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from '@bixbyte/capacitor-apk-installer';
import { Capacitor } from '@capacitor/core';

export const DownloadManager = {
  /**
   * Downloads a file and saves it to the device storage.
   * @param {string} url - The URL of the file to download
   * @param {string} fileName - The name to save the file as
   * @param {Function} onProgress - Callback for progress updates (0-100)
   * @returns {Promise<string>} - The URI of the saved file
   */
  downloadFile: async (url, fileName, onProgress) => {
    try {
      const folderPath = 'Download/cstore';
      const fullPath = `${folderPath}/${fileName}`;
      
      // 1. Ensure the directory exists
      try {
        await Filesystem.mkdir({
          path: folderPath,
          directory: Directory.ExternalStorage,
          recursive: true
        });
      } catch (e) {}

      // 2. Clear and set progress listener
      await Filesystem.removeAllListeners();
      await Filesystem.addListener('progress', (progress) => {
        if (progress.bytes && progress.contentLength) {
          const percent = Math.round((progress.bytes / progress.contentLength) * 100);
          onProgress(percent);
        }
      });

      // 3. Download
      const downloadResult = await Filesystem.downloadFile({
        url: url,
        path: fullPath,
        directory: Directory.ExternalStorage
      });

      // 4. Verify file exists and has size
      await new Promise(r => setTimeout(r, 800));
      const stat = await Filesystem.stat({
        path: fullPath,
        directory: Directory.ExternalStorage
      });

      if (stat.size < 1000000) { // Less than 1MB is likely a warning page
         console.warn('File too small for an APK. Size:', stat.size);
         throw new Error('Google Drive blocked the download (Virus Scan Warning). Please try again.');
      }
      
      // Filesystem.downloadFile returns { path: string }
      return downloadResult.path;
    } catch (error) {
      console.error('Download Manager Error:', error);
      throw error;
    }
  },

  /**
   * Downloads a multi-part file and assembles it.
   */
  downloadChunkedFile: async (urlBase, chunkCount, fileName, onProgress) => {
    const folderPath = 'Download/cstore';
    const finalPath = `${folderPath}/${fileName}`;
    const tempFolder = `${folderPath}/temp`;

    console.log(`Starting chunked download for ${fileName}. Total chunks: ${chunkCount}`);

    try {
      // 1. Setup Directories
      await Filesystem.mkdir({ path: folderPath, directory: Directory.ExternalStorage, recursive: true }).catch(() => {});
      await Filesystem.mkdir({ path: tempFolder, directory: Directory.ExternalStorage, recursive: true }).catch(() => {});

      // 2. Delete existing file if any
      await Filesystem.deleteFile({ path: finalPath, directory: Directory.ExternalStorage }).catch(() => {});

      // 3. Download and Assemble Chunks
      for (let i = 0; i < chunkCount; i++) {
        const chunkUrl = `${urlBase}_part_${i}`;
        const tempChunkFileName = `part_${i}.tmp`;
        const tempChunkPath = `${tempFolder}/${tempChunkFileName}`;
        
        console.log(`Downloading chunk ${i+1}/${chunkCount}...`);
        
        // Download Chunk
        const downloadResult = await Filesystem.downloadFile({
          url: chunkUrl,
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        // Verify Chunk Size
        const chunkStat = await Filesystem.stat({
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        if (chunkStat.size === 0) {
          throw new Error(`Chunk ${i} is empty. Download failed.`);
        }

        // Read Chunk as Base64
        const chunkData = await Filesystem.readFile({
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        // Append to Final File
        await Filesystem.appendFile({
          path: finalPath,
          data: chunkData.data,
          directory: Directory.ExternalStorage
        });

        // Clean up temp chunk
        await Filesystem.deleteFile({
          path: tempChunkPath,
          directory: Directory.ExternalStorage
        });

        // Update Progress
        const overallProgress = Math.round(((i + 1) / chunkCount) * 100);
        onProgress(overallProgress);

        // Small delay to prevent memory spikes on slow devices
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
   * Triggers the APK installation process.
   * @param {string} fileUri - The URI of the APK file
   */
  installApk: async (fileUri) => {
    if (Capacitor.getPlatform() !== 'android') {
      console.warn('APK installation is only supported on Android.');
      return;
    }

    try {
      // 1. Check/Request permission
      const { hasPermission } = await ApkInstaller.checkInstallPermission();
      if (!hasPermission) {
        await ApkInstaller.requestInstallPermission();
      }

      // 2. Install (path needs to be the actual file path, not necessarily the URI)
      const path = fileUri.replace('file://', '');
      await ApkInstaller.installApk({ filePath: path });
    } catch (error) {
      console.error('Installation failed:', error);
      throw error;
    }
  }
};

