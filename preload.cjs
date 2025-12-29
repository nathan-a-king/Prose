const { contextBridge, ipcRenderer } = require('electron');

// Expose file system APIs to the renderer process
contextBridge.exposeInMainWorld('fileSystem', {
  // Open file dialog and return selected file path and content
  openFile: () => ipcRenderer.invoke('file:open'),

  // Read file content from a specific path
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  // Save file to a specific path
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),

  // Show save dialog and save file
  saveFileAs: (content, defaultName) => ipcRenderer.invoke('file:saveAs', content, defaultName),

  // Get file info (name, path, etc.)
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath),

  // Check if a file exists
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
});

// Expose IPC event listeners for menu commands
contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for menu events
  onNewDocument: (callback) => ipcRenderer.on('new-document', callback),
  onSaveDocument: (callback) => ipcRenderer.on('save-document', callback),
  onOpenFile: (callback) => ipcRenderer.on('menu:openFile', callback),
  onSaveFileAs: (callback) => ipcRenderer.on('menu:saveFileAs', callback),

  // Remove listeners
  removeNewDocumentListener: () => ipcRenderer.removeAllListeners('new-document'),
  removeSaveDocumentListener: () => ipcRenderer.removeAllListeners('save-document'),
  removeOpenFileListener: () => ipcRenderer.removeAllListeners('menu:openFile'),
  removeSaveFileAsListener: () => ipcRenderer.removeAllListeners('menu:saveFileAs'),
});

// Expose secure storage APIs to the renderer process
contextBridge.exposeInMainWorld('secureStorage', {
  // Set encrypted value
  set: (key, value) => ipcRenderer.invoke('secure-storage:set', key, value),

  // Get decrypted value
  get: (key) => ipcRenderer.invoke('secure-storage:get', key),

  // Check if key exists
  has: (key) => ipcRenderer.invoke('secure-storage:has', key),

  // Delete key
  delete: (key) => ipcRenderer.invoke('secure-storage:delete', key)
});
