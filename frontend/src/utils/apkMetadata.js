/**
 * CStore Client-Side APK Metadata & Icon Extractor
 * Parses AndroidManifest.xml and resources.arsc in pure browser offline mode.
 */

let parserPromise = null;

export async function getAppInfoParser() {
  if (typeof window === 'undefined') return null;
  if (window.AppInfoParser) return window.AppInfoParser;

  if (!parserPromise) {
    parserPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="app-info-parser.min.js"]');
      if (existing) {
        if (window.AppInfoParser) return resolve(window.AppInfoParser);
        existing.addEventListener('load', () => resolve(window.AppInfoParser));
        existing.addEventListener('error', () => reject(new Error('Failed to load APK parser bundle')));
        return;
      }

      const script = document.createElement('script');
      script.src = '/libs/app-info-parser.min.js';
      script.async = true;
      script.onload = () => {
        if (window.AppInfoParser) {
          resolve(window.AppInfoParser);
        } else {
          reject(new Error('AppInfoParser object not found after script load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load /libs/app-info-parser.min.js'));
      document.head.appendChild(script);
    });
  }

  return parserPromise;
}

export function base64ToFile(dataurl, filename = 'app-icon.png') {
  if (!dataurl || typeof dataurl !== 'string' || !dataurl.startsWith('data:image')) {
    return null;
  }
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const ext = mime.includes('webp') ? '.webp' : mime.includes('jpeg') ? '.jpg' : '.png';
    const safeName = filename.replace(/\.[^/.]+$/, '');
    return new File([u8arr], `${safeName}${ext}`, { type: mime });
  } catch (err) {
    console.warn('base64ToFile failed:', err);
    return null;
  }
}

export async function parseApkMetadata(file) {
  if (!file) return null;

  const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
  const rawFileName = file.name ? file.name.replace(/\.apk$/i, '') : 'App';
  
  // Clean fallback app name from file name (e.g. "MsmKhata-release-v1.0.2" -> "MsmKhata")
  const fallbackName = rawFileName
    .replace(/[-_]?(release|debug|unsigned|signed|v?\d+(\.\d+)*).*$/i, '')
    .replace(/[-_]/g, ' ')
    .trim() || 'My App';

  try {
    const ParserClass = await getAppInfoParser();
    if (!ParserClass) {
      return {
        name: fallbackName,
        version: '',
        size: sizeMB,
        packageName: '',
        iconFile: null,
        iconDataUrl: null
      };
    }

    const parser = new ParserClass(file);
    const result = await parser.parse();

    // 1. Extract Name
    let appName = '';
    const labelRaw = result.application?.label || result['application-label'] || result.label;
    if (typeof labelRaw === 'string') {
      appName = labelRaw;
    } else if (Array.isArray(labelRaw) && labelRaw.length > 0) {
      appName = String(labelRaw[0]);
    } else if (labelRaw && typeof labelRaw === 'object') {
      appName = labelRaw['en'] || labelRaw['en-US'] || Object.values(labelRaw)[0] || '';
    }

    // Clean up resource IDs or empty names
    if (!appName || /^@?(0x)?[0-9a-fA-F]+$/.test(appName)) {
      appName = fallbackName;
    }

    // 2. Extract Version
    let versionName = result.versionName || '';
    if (versionName) {
      versionName = String(versionName).trim();
      if (!versionName.toLowerCase().startsWith('v')) {
        versionName = `v${versionName}`;
      }
    }

    // 3. Extract Icon
    let iconDataUrl = null;
    let iconFile = null;
    if (result.icon && typeof result.icon === 'string' && result.icon.startsWith('data:image')) {
      iconDataUrl = result.icon;
      iconFile = base64ToFile(result.icon, `${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_icon.png`);
    }

    // 4. Package Name
    const packageName = result.package || '';

    return {
      name: appName,
      version: versionName,
      size: sizeMB,
      packageName,
      iconFile,
      iconDataUrl
    };
  } catch (err) {
    console.warn('APK parsing error (falling back to file defaults):', err);
    return {
      name: fallbackName,
      version: '',
      size: sizeMB,
      packageName: '',
      iconFile: null,
      iconDataUrl: null,
      error: err.message
    };
  }
}

export const CATEGORIES = [
  'Tools',
  'Productivity',
  'Social & Communication',
  'Entertainment & Media',
  'Games',
  'Finance & Business',
  'Utilities',
  'Education',
  'Personalization',
  'Other'
];

/**
 * Extracts clean category name from an app object (checks app.category, app.tags, or app.description [Category: ...])
 */
export function getAppCategory(app) {
  if (!app) return 'Tools';
  if (app.category && typeof app.category === 'string') return app.category;
  if (app.tags && Array.isArray(app.tags) && app.tags.length > 0) return app.tags[0];
  if (app.description) {
    const match = app.description.match(/\[Category:\s*([^\]]+)\]/i);
    if (match) return match[1].trim();
  }
  const name = (app.name || '').toLowerCase();
  const desc = (app.description || '').toLowerCase();
  if (name.includes('khata') || desc.includes('bookkeeping') || desc.includes('ledger') || desc.includes('finance')) return 'Finance & Business';
  if (name.includes('chat') || desc.includes('messaging') || desc.includes('calling')) return 'Social & Communication';
  if (name.includes('connect') || desc.includes('companion') || desc.includes('sync')) return 'Productivity';
  if (name.includes('calculator') || name.includes('area') || desc.includes('measurement')) return 'Tools';
  if (name.includes('hide') || desc.includes('security') || desc.includes('privacy')) return 'Tools';
  if (name.includes('store')) return 'Tools';
  return 'Tools';
}

/**
 * Removes [Category: ...] header from prose text so users only see clean description
 */
export function cleanAppDescription(description) {
  if (!description) return '';
  return description.replace(/^\[Category:\s*[^\]]+\]\s*/i, '').trim();
}

/**
 * Returns distinct styling for category badges
 */
export function getCategoryBadgeStyle(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('finance') || cat.includes('business')) {
    return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', color: '#34d399' };
  }
  if (cat.includes('social') || cat.includes('communication')) {
    return { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' };
  }
  if (cat.includes('productivity')) {
    return { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' };
  }
  if (cat.includes('game') || cat.includes('entertainment') || cat.includes('media')) {
    return { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)', color: '#fb7185' };
  }
  return { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)', color: '#a5b4fc' };
}
