import { app, BrowserWindow, Menu, nativeTheme, screen, shell, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === 'development';
const port = isDev ? 3000 : 8080;

// Set app name early
app.setName('Prose');

// Set about panel options for macOS
app.setAboutPanelOptions({
  applicationName: 'Prose',
  applicationVersion: '1.5.0',
  version: '1.5.0',
  copyright: '© 2025 Prose',
  credits: 'In loving memory of Philip King'
});

function findNodeBinary() {
  // Common Node.js locations to try
  const commonPaths = [
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
    '/usr/bin/node',
  ];

  // Dynamically find NVM/fnm/volta paths instead of hardcoding a version
  if (process.env.NVM_DIR) {
    const nvmCurrent = path.join(process.env.NVM_DIR, 'current', 'bin', 'node');
    commonPaths.unshift(nvmCurrent);
  }
  if (process.env.FNM_DIR) {
    const fnmCurrent = path.join(process.env.FNM_DIR, 'current', 'bin', 'node');
    commonPaths.unshift(fnmCurrent);
  }
  if (process.env.VOLTA_HOME) {
    const voltaBin = path.join(process.env.VOLTA_HOME, 'bin', 'node');
    commonPaths.unshift(voltaBin);
  }

  // Build an extended PATH from known manager locations
  const extraPaths = commonPaths.map(p => path.dirname(p)).join(':');

  // First try the current process.env PATH
  try {
    const result = execSync('which node', {
      env: {
        ...process.env,
        PATH: process.env.PATH + ':' + extraPaths
      }
    }).toString().trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (e) {
    // which command failed, try common paths
  }
  
  // Try common paths
  for (const nodePath of commonPaths) {
    if (fs.existsSync(nodePath)) {
      console.log('Found node at:', nodePath);
      return nodePath;
    }
  }
  
  // Fallback to just 'node' and hope it's in PATH
  console.log('Using fallback: node');
  return 'node';
}

function animateWindowToCenter(window) {
  const currentBounds = window.getBounds();
  const display = screen.getDisplayMatching(currentBounds);
  const displayBounds = display.workArea;
  
  // Calculate center position
  const targetX = Math.round(displayBounds.x + (displayBounds.width - currentBounds.width) / 2);
  const targetY = Math.round(displayBounds.y + (displayBounds.height - currentBounds.height) / 2);
  
  // Current position
  const startX = currentBounds.x;
  const startY = currentBounds.y;
  
  // Skip animation if already centered (within 5px tolerance)
  if (Math.abs(startX - targetX) < 5 && Math.abs(startY - targetY) < 5) {
    return;
  }
  
  // Animation parameters - smoother like VSCode
  const duration = 250; // milliseconds, slightly faster
  const startTime = Date.now();
  
  const animate = () => {
    if (window.isDestroyed()) {
      return;
    }
    
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress >= 1) {
      // Ensure we end exactly at the target position
      window.setPosition(targetX, targetY);
      return;
    }
    
    // Use ease-out-quart for smoother motion like VSCode
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    
    // Calculate current position with sub-pixel precision
    const currentX = Math.round(startX + (targetX - startX) * easeOutQuart);
    const currentY = Math.round(startY + (targetY - startY) * easeOutQuart);
    
    window.setPosition(currentX, currentY);
    
    // Use requestAnimationFrame equivalent for smoother animation
    setImmediate(animate);
  };
  
  animate();
}

function startServer() {
  if (!isDev) {
    console.log('Starting production server...');
    
    // Check if running from asar archive
    const isPackaged = __dirname.includes('app.asar');
    let serverPath;
    let workingDir;
    
    if (isPackaged) {
      // In packaged app, unpacked files are in app.asar.unpacked
      workingDir = __dirname.replace('app.asar', 'app.asar.unpacked');
      serverPath = path.join(workingDir, 'server.js');
    } else {
      workingDir = __dirname;
      serverPath = path.join(__dirname, 'server.js');
    }
    
    console.log('Server path:', serverPath);
    console.log('Working dir:', workingDir);
    
    const nodeBinary = findNodeBinary();
    console.log('Using node binary:', nodeBinary);
    
    // Get userData path for storing database
    const userDataPath = app.getPath('userData');
    console.log('User data path:', userDataPath);
    
    serverProcess = spawn(nodeBinary, [serverPath], {
      cwd: workingDir,
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        USER_DATA_PATH: userDataPath,
        PATH: process.env.PATH + ':' + path.dirname(nodeBinary) + ':/usr/local/bin:/opt/homebrew/bin'
      }
    });

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      // Listen for server output and ready signal
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Server: ${output.trim()}`);
        
        if (output.includes('Server running on port') && !resolved) {
          resolved = true;
          console.log('Server is ready');
          setTimeout(resolve, 1000); // Small delay to ensure server is fully ready
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data}`);
      });
      
      serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
      
      // Fallback timeout after 8 seconds
      setTimeout(() => {
        if (!resolved) {
          console.log('Server startup timeout - proceeding anyway');
          resolved = true;
          resolve();
        }
      }, 8000);
    });
  }
  console.log('Development mode - expecting external server');
  return Promise.resolve();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    show: true // Show immediately
  });

  // Set Content Security Policy based on environment
  const session = mainWindow.webContents.session;
  session.webRequest.onHeadersReceived((details, callback) => {
    // Development CSP - relaxed for Vite HMR and React DevTools
    const devCSP = [
      "default-src 'self' http://localhost:* ws://localhost:*; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; " +
      "style-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com; " +
      "img-src 'self' data: http://localhost:*; " +
      "connect-src 'self' http://localhost:* ws://localhost:*; " +
      "font-src 'self' data: https://fonts.gstatic.com;"
    ];

    // Production CSP - strict, no unsafe directives
    const prodCSP = [
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' https://fonts.googleapis.com; " +
      "img-src 'self' data:; " +
      "connect-src 'self'; " +
      "font-src 'self' data: https://fonts.gstatic.com;"
    ];

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': isDev ? devCSP : prodCSP
      }
    });
  });

  const url = isDev 
    ? `http://localhost:${port}`
    : `http://localhost:${port}`;

  console.log(`Loading URL: ${url}`);
  
  // Retry loading URL with backoff
  const loadWithRetry = async (retries = 6, delay = 3000) => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Loading attempt ${i + 1}/${retries}`);
        await mainWindow.loadURL(url);
        console.log('Successfully loaded URL');
        return;
      } catch (err) {
        console.error(`Load attempt ${i + 1} failed:`, err.message);
        if (i < retries - 1) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Exponential backoff
        } else {
          // Final fallback - show error page
          console.error('All retry attempts failed, showing error page');
          await mainWindow.loadURL(`data:text/html,<h1>Error loading app</h1><p>Could not connect to server after ${retries} attempts</p><p>URL: ${url}</p><button onclick="window.location.reload()">Retry</button>`);
        }
      }
    }
  };
  
  loadWithRetry();

  // Handle external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Prevent navigation away from the app
    if (!url.startsWith(`http://localhost:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle new window requests (e.g., target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-document');
          }
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu:openFile');
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-document');
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu:saveFileAs');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
        {
          label: 'Center',
          accelerator: 'Fn+Ctrl+C',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              animateWindowToCenter(mainWindow);
            }
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: 'Services', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Hide ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Command+Option+H', role: 'hideothers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Validate file paths for direct-access IPC handlers to prevent path traversal
function validateFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('Invalid file path');
  }

  const resolved = path.resolve(filePath);
  const homeDir = app.getPath('home');
  const documentsDir = app.getPath('documents');
  const desktopDir = app.getPath('desktop');
  const downloadsDir = app.getPath('downloads');
  const userDataDir = app.getPath('userData');

  const allowedPrefixes = [homeDir, documentsDir, desktopDir, downloadsDir, userDataDir];

  // Block known sensitive system directories
  const blockedPrefixes = ['/etc', '/System', '/usr', '/bin', '/sbin', '/var', '/private/etc'];
  for (const blocked of blockedPrefixes) {
    if (resolved.startsWith(blocked)) {
      throw new Error('Access to this path is not allowed');
    }
  }

  // Must be under user's home directory
  if (!allowedPrefixes.some(prefix => resolved.startsWith(prefix))) {
    throw new Error('File path must be within the user home directory');
  }

  return resolved;
}

// IPC Handlers for file system operations
ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  } catch (error) {
    console.error('Error reading file:', error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const safePath = validateFilePath(filePath);
    const content = fs.readFileSync(safePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('file:save', async (event, filePath, content) => {
  try {
    const safePath = validateFilePath(filePath);
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, filePath: safePath };
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
});

ipcMain.handle('file:saveAs', async (event, content, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'untitled.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
});

ipcMain.handle('file:getInfo', async (event, filePath) => {
  try {
    const safePath = validateFilePath(filePath);
    const stats = fs.statSync(safePath);
    return {
      name: path.basename(safePath),
      path: safePath,
      size: stats.size,
      modifiedAt: stats.mtime
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
});

ipcMain.handle('file:exists', async (event, filePath) => {
  try {
    const safePath = validateFilePath(filePath);
    return fs.existsSync(safePath);
  } catch (error) {
    return false;
  }
});

// Validate storage key to prevent path traversal (e.g. ../../etc/foo)
function validateStorageKey(key) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw new Error('Invalid storage key');
  }
}

// Secure Storage IPC Handlers for API key encryption
ipcMain.handle('secure-storage:set', async (event, key, value) => {
  try {
    validateStorageKey(key);
    const { safeStorage } = await import('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this system');
    }

    const encrypted = safeStorage.encryptString(value);
    const base64 = encrypted.toString('base64');

    // Store in userData directory
    const userDataPath = app.getPath('userData');
    const keyFilePath = path.join(userDataPath, `${key}.enc`);
    fs.writeFileSync(keyFilePath, base64, 'utf-8');

    console.log(`[Secure Storage] Encrypted key stored: ${key}`);
    return { success: true };
  } catch (error) {
    console.error('[Secure Storage] Error encrypting key:', error);
    throw new Error(`Failed to store key: ${error.message}`);
  }
});

ipcMain.handle('secure-storage:get', async (event, key) => {
  try {
    validateStorageKey(key);
    const { safeStorage } = await import('electron');
    const userDataPath = app.getPath('userData');
    const keyFilePath = path.join(userDataPath, `${key}.enc`);

    if (!fs.existsSync(keyFilePath)) {
      return null;
    }

    const base64 = fs.readFileSync(keyFilePath, 'utf-8');
    const encrypted = Buffer.from(base64, 'base64');

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this system');
    }

    const decrypted = safeStorage.decryptString(encrypted);
    console.log(`[Secure Storage] Key retrieved: ${key}`);
    return decrypted;
  } catch (error) {
    console.error('[Secure Storage] Error decrypting key:', error);
    throw new Error(`Failed to retrieve key: ${error.message}`);
  }
});

ipcMain.handle('secure-storage:has', async (event, key) => {
  try {
    validateStorageKey(key);
    const userDataPath = app.getPath('userData');
    const keyFilePath = path.join(userDataPath, `${key}.enc`);
    return fs.existsSync(keyFilePath);
  } catch (error) {
    console.error('[Secure Storage] Error checking key existence:', error);
    return false;
  }
});

ipcMain.handle('secure-storage:delete', async (event, key) => {
  try {
    validateStorageKey(key);
    const userDataPath = app.getPath('userData');
    const keyFilePath = path.join(userDataPath, `${key}.enc`);

    if (fs.existsSync(keyFilePath)) {
      fs.unlinkSync(keyFilePath);
      console.log(`[Secure Storage] Key deleted: ${key}`);
      return { success: true };
    }
    return { success: false, error: 'Key not found' };
  } catch (error) {
    console.error('[Secure Storage] Error deleting key:', error);
    throw new Error(`Failed to delete key: ${error.message}`);
  }
});

app.whenReady().then(async () => {
  createMenu();

  try {
    await startServer();
    createWindow();
  } catch (error) {
    console.error('Server startup failed:', error);
    // Still create window even if server fails
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});