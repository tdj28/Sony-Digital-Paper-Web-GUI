// Sony Digital Paper Manager - JavaScript Application Logic

// State
let deviceConnected = false;
let currentLocalPath = '';
let currentDevicePath = 'Document';
let selectedLocalFiles = new Set();
let selectedDeviceFiles = new Set();

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const statusBar = document.getElementById('statusBar');
const statusMessage = document.getElementById('statusMessage');
const deviceInfo = document.getElementById('deviceInfo');
const batteryLevel = document.getElementById('batteryLevel');
const storageUsed = document.getElementById('storageUsed');
const storageTotal = document.getElementById('storageTotal');

const localFileList = document.getElementById('localFileList');
const deviceFileList = document.getElementById('deviceFileList');
const localPath = document.getElementById('localPath');
const devicePath = document.getElementById('devicePath');

const localUpBtn = document.getElementById('localUpBtn');
const localRefreshBtn = document.getElementById('localRefreshBtn');
const localSelectAllBtn = document.getElementById('localSelectAllBtn');
const uploadBtn = document.getElementById('uploadBtn');

// Sync buttons
const backupBtn = document.getElementById('backupBtn');
const uploadAllBtn = document.getElementById('uploadAllBtn');
const syncToBtn = document.getElementById('syncToBtn');

const deviceUpBtn = document.getElementById('deviceUpBtn');
const deviceRefreshBtn = document.getElementById('deviceRefreshBtn');
const deviceSelectAllBtn = document.getElementById('deviceSelectAllBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const deleteBtn = document.getElementById('deleteBtn');

const newFolderModal = document.getElementById('newFolderModal');
const folderNameInput = document.getElementById('folderNameInput');
const createFolderBtn = document.getElementById('createFolderBtn');
const cancelFolderBtn = document.getElementById('cancelFolderBtn');

const deleteModal = document.getElementById('deleteModal');
const deleteCount = document.getElementById('deleteCount');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Progress bar elements
const progressContainer = document.getElementById('progressContainer');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const progressDetail = document.getElementById('progressDetail');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLocalFiles();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    connectBtn.addEventListener('click', connectToDevice);

    localSelectAllBtn.addEventListener('click', () => selectAll('local'));
    localUpBtn.addEventListener('click', () => navigateLocalUp());
    localRefreshBtn.addEventListener('click', () => loadLocalFiles());
    uploadBtn.addEventListener('click', uploadToDevice);

    // Sync buttons
    backupBtn.addEventListener('click', backupFromDevice);
    uploadAllBtn.addEventListener('click', uploadAllToDevice);
    syncToBtn.addEventListener('click', syncToDevice);

    deviceSelectAllBtn.addEventListener('click', () => selectAll('device'));
    deviceUpBtn.addEventListener('click', () => navigateDeviceUp());
    deviceRefreshBtn.addEventListener('click', () => loadDeviceFiles());
    newFolderBtn.addEventListener('click', showNewFolderModal);
    downloadBtn.addEventListener('click', downloadFromDevice);
    deleteBtn.addEventListener('click', showDeleteModal);

    createFolderBtn.addEventListener('click', createFolder);
    cancelFolderBtn.addEventListener('click', hideNewFolderModal);
    confirmDeleteBtn.addEventListener('click', deleteFiles);
    cancelDeleteBtn.addEventListener('click', hideDeleteModal);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideNewFolderModal();
            hideDeleteModal();
        }
        if (e.key === 'Enter' && !newFolderModal.classList.contains('hidden')) {
            createFolder();
        }
    });
}

// Status Messages
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusBar.className = `status-bar ${type}`;
    statusBar.classList.remove('hidden');

    setTimeout(() => {
        statusBar.classList.add('hidden');
    }, 5000);
}

// Connect to Device
async function connectToDevice() {
    connectBtn.disabled = true;
    connectBtn.textContent = '🔄 Connecting...';

    try {
        const response = await fetch('/api/device/connect');
        const data = await response.json();

        if (data.success) {
            deviceConnected = true;
            connectBtn.textContent = '✅ Connected';
            connectBtn.classList.add('btn-success');
            showStatus(data.message, 'success');

            // Enable device controls
            deviceSelectAllBtn.disabled = false;
            deviceUpBtn.disabled = false;
            deviceRefreshBtn.disabled = false;
            newFolderBtn.disabled = false;
            backupBtn.disabled = false;
            uploadAllBtn.disabled = false;
            syncToBtn.disabled = false;

            // Load device files
            await loadDeviceFiles();
            await updateDeviceInfo();
        } else {
            showStatus(data.error, 'error');
            connectBtn.disabled = false;
            connectBtn.textContent = '🔌 Connect to Device';
        }
    } catch (error) {
        showStatus(`Connection failed: ${error.message}`, 'error');
        connectBtn.disabled = false;
        connectBtn.textContent = '🔌 Connect to Device';
    }
}

// Update Device Info
async function updateDeviceInfo() {
    try {
        const response = await fetch('/api/device/info');
        const data = await response.json();

        console.log('Device info response:', data);

        if (data.success) {
            // Battery level is a string like "60"
            const battery = data.battery;
            const batteryValue = battery?.level ?? '--';
            batteryLevel.textContent = batteryValue;

            // Storage: available and capacity in bytes (as strings)
            const storage = data.storage;
            const capacity = parseInt(storage?.capacity || 0);
            const available = parseInt(storage?.available || 0);
            const used = capacity - available;

            storageUsed.textContent = formatBytes(used);
            storageTotal.textContent = formatBytes(capacity);

            deviceInfo.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to update device info:', error);
    }
}

// Load Local Files
async function loadLocalFiles(path = '') {
    try {
        const url = path ? `/api/local/list?path=${encodeURIComponent(path)}` : '/api/local/list';
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            currentLocalPath = data.path;
            localPath.textContent = data.path;
            renderFileList(localFileList, data.folders, data.files, 'local');
            selectedLocalFiles.clear();
            updateUploadButton();
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Failed to load local files: ${error.message}`, 'error');
    }
}

// Load Device Files
async function loadDeviceFiles(path = 'Document') {
    if (!deviceConnected) return;

    try {
        const response = await fetch(`/api/device/list?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.success) {
            currentDevicePath = data.path;
            devicePath.textContent = data.path;
            renderFileList(deviceFileList, data.folders, data.files, 'device');
            selectedDeviceFiles.clear();
            updateDeviceButtons();
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Failed to load device files: ${error.message}`, 'error');
    }
}

// Render File List
function renderFileList(container, folders, files, type) {
    container.innerHTML = '';

    if (folders.length === 0 && files.length === 0) {
        container.innerHTML = '<div class="placeholder"><p>📂 Empty folder</p></div>';
        return;
    }

    // Render folders
    folders.forEach(folder => {
        const item = createFileItem(folder, 'folder', type);
        container.appendChild(item);
    });

    // Render files
    files.forEach(file => {
        const item = createFileItem(file, 'file', type);
        container.appendChild(item);
    });
}

// Create File Item Element
function createFileItem(item, itemType, listType) {
    const div = document.createElement('div');
    div.className = `file-item ${itemType}`;
    div.dataset.path = item.path;
    div.dataset.name = item.name;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        handleFileSelect(item.path, listType, checkbox.checked);
    });

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = itemType === 'folder' ? '📁' : '📄';

    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    if (itemType === 'file') {
        meta.textContent = formatBytes(item.size);
    } else {
        meta.textContent = 'Folder';
    }

    info.appendChild(name);
    info.appendChild(meta);

    div.appendChild(checkbox);
    div.appendChild(icon);
    div.appendChild(info);

    // Double-click to navigate into folders
    div.addEventListener('dblclick', () => {
        if (itemType === 'folder') {
            if (listType === 'local') {
                loadLocalFiles(item.path);
            } else {
                loadDeviceFiles(item.path);
            }
        }
    });

    // Single click to select
    div.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            handleFileSelect(item.path, listType, checkbox.checked);
        }
    });

    return div;
}

// Handle File Selection
function handleFileSelect(path, listType, selected) {
    const selectedSet = listType === 'local' ? selectedLocalFiles : selectedDeviceFiles;

    if (selected) {
        selectedSet.add(path);
    } else {
        selectedSet.delete(path);
    }

    if (listType === 'local') {
        updateUploadButton();
    } else {
        updateDeviceButtons();
    }
}

// Update Upload Button
function updateUploadButton() {
    uploadBtn.disabled = selectedLocalFiles.size === 0 || !deviceConnected;
}

// Update Device Buttons
function updateDeviceButtons() {
    const hasSelection = selectedDeviceFiles.size > 0;
    downloadBtn.disabled = !hasSelection;
    deleteBtn.disabled = !hasSelection;
}

// Select All
function selectAll(listType) {
    const container = listType === 'local' ? localFileList : deviceFileList;
    const selectedSet = listType === 'local' ? selectedLocalFiles : selectedDeviceFiles;
    const fileItems = container.querySelectorAll('.file-item');

    // Check if all are already selected
    const allSelected = fileItems.length > 0 && selectedSet.size === fileItems.length;

    fileItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const path = item.dataset.path;

        if (allSelected) {
            // Deselect all
            checkbox.checked = false;
            selectedSet.delete(path);
        } else {
            // Select all
            checkbox.checked = true;
            selectedSet.add(path);
        }
    });

    if (listType === 'local') {
        updateUploadButton();
    } else {
        updateDeviceButtons();
    }

    const count = selectedSet.size;
    showStatus(allSelected ? '☐ Deselected all' : `☑️ Selected ${count} item(s)`, 'info');
}

// Navigate Up
function navigateLocalUp() {
    const parent = currentLocalPath.split('/').slice(0, -1).join('/');
    loadLocalFiles(parent || '/');
}

function navigateDeviceUp() {
    if (currentDevicePath === 'Document') return;
    const parent = currentDevicePath.split('/').slice(0, -1).join('/');
    loadDeviceFiles(parent || 'Document');
}

// Upload to Device
async function uploadToDevice() {
    if (selectedLocalFiles.size === 0) return;

    const formData = new FormData();
    formData.append('remote_path', currentDevicePath);

    try {
        // Read and append files
        for (const filePath of selectedLocalFiles) {
            const response = await fetch(`file://${filePath}`);
            const blob = await response.blob();
            const fileName = filePath.split('/').pop();
            formData.append('files', blob, fileName);
        }

        showStatus('📤 Uploading files...', 'info');

        const response = await fetch('/api/device/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showStatus(data.message, 'success');
            selectedLocalFiles.clear();
            updateUploadButton();
            await loadDeviceFiles(currentDevicePath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Upload failed: ${error.message}`, 'error');
    }
}

// Download from Device (with recursive folder support)
async function downloadFromDevice() {
    if (selectedDeviceFiles.size === 0) return;

    const paths = Array.from(selectedDeviceFiles);

    downloadBtn.disabled = true;
    showProgress('📥 Downloading...', 0, `${paths.length} item(s) to ${currentLocalPath}`);

    try {
        // Use recursive download endpoint
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 3, 90);
            updateProgress(progress, 'Downloading files...');
        }, 300);

        const response = await fetch('/api/device/download-recursive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paths: paths,
                local_folder: currentLocalPath
            })
        });

        clearInterval(progressInterval);
        const data = await response.json();

        if (data.success) {
            updateProgress(100, `Downloaded ${data.total} file(s)!`);
            showStatus(data.message, 'success');
            selectedDeviceFiles.clear();
            updateDeviceButtons();
            // Refresh local files to show the downloaded files
            await loadLocalFiles(currentLocalPath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Download failed: ${error.message}`, 'error');
    } finally {
        downloadBtn.disabled = false;
        setTimeout(hideProgress, 2000);
    }
}

// Show New Folder Modal
function showNewFolderModal() {
    folderNameInput.value = '';
    newFolderModal.classList.remove('hidden');
    folderNameInput.focus();
}

function hideNewFolderModal() {
    newFolderModal.classList.add('hidden');
}

// Create Folder
async function createFolder() {
    const folderName = folderNameInput.value.trim();

    if (!folderName) {
        showStatus('Please enter a folder name! 📁', 'error');
        return;
    }

    const folderPath = `${currentDevicePath}/${folderName}`;

    try {
        const response = await fetch('/api/device/folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: folderPath })
        });

        const data = await response.json();

        if (data.success) {
            showStatus(data.message, 'success');
            hideNewFolderModal();
            await loadDeviceFiles(currentDevicePath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Failed to create folder: ${error.message}`, 'error');
    }
}

// Show Delete Modal
function showDeleteModal() {
    if (selectedDeviceFiles.size === 0) return;

    deleteCount.textContent = selectedDeviceFiles.size;
    deleteModal.classList.remove('hidden');
}

function hideDeleteModal() {
    deleteModal.classList.add('hidden');
}

// Delete Files
async function deleteFiles() {
    const paths = Array.from(selectedDeviceFiles);

    try {
        showStatus('🗑️ Deleting...', 'info');

        const response = await fetch('/api/device/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths })
        });

        const data = await response.json();

        if (data.success) {
            showStatus(data.message, 'success');
            hideDeleteModal();
            selectedDeviceFiles.clear();
            updateDeviceButtons();
            await loadDeviceFiles(currentDevicePath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Delete failed: ${error.message}`, 'error');
    }
}

// Utility Functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Progress Bar Functions
function showProgress(label, percent = 0, detail = '') {
    progressContainer.classList.remove('hidden');
    progressLabel.textContent = label;
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    progressDetail.textContent = detail;
}

function updateProgress(percent, detail = '') {
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    if (detail) progressDetail.textContent = detail;
}

function hideProgress() {
    progressContainer.classList.add('hidden');
}

// Backup: Download All from Device (skips existing)
async function backupFromDevice() {
    if (!deviceConnected) return;

    const localFolder = currentLocalPath;

    backupBtn.classList.add('syncing');
    backupBtn.disabled = true;

    showProgress('📥 Backing up device...', 0, `Downloading to ${localFolder}`);

    try {
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 2, 90);
            updateProgress(progress, 'Downloading files...');
        }, 500);

        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_folder: localFolder })
        });

        clearInterval(progressInterval);
        const data = await response.json();

        if (data.success) {
            updateProgress(100, `Downloaded ${data.downloaded}, skipped ${data.skipped}`);
            showStatus(data.message, 'success');
            await loadLocalFiles(currentLocalPath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Backup failed: ${error.message}`, 'error');
    } finally {
        backupBtn.classList.remove('syncing');
        backupBtn.disabled = false;
        setTimeout(hideProgress, 3000);
    }
}

// Upload All: Upload from Local to Device (skips existing)
async function uploadAllToDevice() {
    if (!deviceConnected) return;

    const localFolder = currentLocalPath;

    uploadAllBtn.classList.add('syncing');
    uploadAllBtn.disabled = true;

    showProgress('📤 Uploading to device...', 0, `Uploading from ${localFolder}`);

    try {
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 2, 90);
            updateProgress(progress, 'Uploading files...');
        }, 500);

        const response = await fetch('/api/upload-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_folder: localFolder })
        });

        clearInterval(progressInterval);
        const data = await response.json();

        if (data.success) {
            updateProgress(100, `Uploaded ${data.uploaded}, skipped ${data.skipped}`);
            showStatus(data.message, 'success');
            await loadDeviceFiles(currentDevicePath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Upload failed: ${error.message}`, 'error');
    } finally {
        uploadAllBtn.classList.remove('syncing');
        uploadAllBtn.disabled = false;
        setTimeout(hideProgress, 3000);
    }
}

// Sync To Device: Make device mirror local (uploads new, DELETES from device!)
async function syncToDevice() {
    if (!deviceConnected) return;

    // Confirm because this deletes files!
    if (!confirm('⚠️ SYNC will:\n• Upload files from local to device\n• DELETE files from device that are not in local folder\n\nAre you sure?')) {
        return;
    }

    const localFolder = currentLocalPath;

    syncToBtn.classList.add('syncing');
    syncToBtn.disabled = true;

    showProgress('🔄 Syncing to device...', 0, `Mirroring ${localFolder} to device`);

    try {
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 2, 90);
            updateProgress(progress, 'Syncing files...');
        }, 500);

        const response = await fetch('/api/sync-to-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_folder: localFolder })
        });

        clearInterval(progressInterval);
        const data = await response.json();

        if (data.success) {
            updateProgress(100, `Uploaded ${data.uploaded}, deleted ${data.deleted}`);
            showStatus(data.message, 'success');
            await loadDeviceFiles(currentDevicePath);
        } else {
            showStatus(data.error, 'error');
        }
    } catch (error) {
        showStatus(`Sync failed: ${error.message}`, 'error');
    } finally {
        syncToBtn.classList.remove('syncing');
        syncToBtn.disabled = false;
        setTimeout(hideProgress, 3000);
    }
}
