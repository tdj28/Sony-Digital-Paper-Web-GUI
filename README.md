# Sony Digital Paper Web GUI

A web-based file manager for Sony Digital Paper devices that wraps [dpt-rp1-py](https://github.com/janten/dpt-rp1-py). Manage your files with a split-pane interface.

## Features

- 🎨 **Modern UI** - Dark mode with glassmorphism and smooth animations
- 📂 **Split-Pane Interface** - Local files on the left, device files on the right
- 🔄 **Auto-Discovery** - Automatically finds your device on the network (no IP needed!)
- 📤 **Easy File Transfer** - Upload and download files with a click
- ✅ **Multi-Select** - Select multiple files for bulk operations
- 🗑️ **File Management** - Delete files, create folders, navigate directories
- 📊 **Device Info** - See battery level and storage usage at a glance

## Prerequisites

1. **Install UV** (if you haven't already):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Register your device** (one-time setup):
   ```bash
   dptrp1 register
   ```
   
   This creates authentication files in `~/.config/dpt/` that the GUI will use.

3. **Ensure your device is on the same network** as your computer

## Installation

1. Sync dependencies with UV:
   ```bash
   uv sync
   ```

## Usage

1. Start the server with UV:
   ```bash
   uv run python app.py
   ```
   
   Or use the installed script:
   ```bash
   uv run sony-paper-gui
   ```

2. Open your browser to:
   ```
   http://localhost:5001
   ```

3. Click "Connect to Device" and start managing files! 🎉

## How to Use

### Connecting
- Click the "🔌 Connect to Device" button
- The app will automatically discover your Digital Paper device
- Once connected, you'll see your device files on the right panel

### Uploading Files
1. Navigate to the folder on your local system (left panel)
2. Select files by clicking their checkboxes
3. Click "📤 Upload to Device"
4. Files will be uploaded to the current device folder

### Downloading Files
1. Navigate to the folder on your device (right panel)
2. Select files by clicking their checkboxes
3. Click "📥 Download"
4. Files will download to your browser's download folder

### Creating Folders
1. Navigate to where you want the new folder (right panel)
2. Click "📁 New Folder"
3. Enter the folder name
4. Click "Create"

### Deleting Files
1. Select files/folders on the device (right panel)
2. Click "🗑️ Delete"
3. Confirm the deletion

### Navigation
- **Double-click** a folder to open it
- Click **⬆️ Up** to go to the parent folder
- Click **🔄 Refresh** to reload the current folder

## Keyboard Shortcuts

- `Escape` - Close modals
- `Enter` - Confirm folder creation (when modal is open)

## Troubleshooting

### "Authentication files not found"
Run `dptrp1 register` first to set up authentication with your device.

### "Device not found"
Make sure:
- Your device is turned on
- WiFi is enabled on the device
- Your device and computer are on the same network
- You've recently accessed WiFi settings on the device (auto-discovery works for a few minutes after turning on WiFi)

### Connection issues
Try running a command-line command first to verify connectivity:
```bash
dptrp1 list-documents
```

## Credits

Built with:
- [dpt-rp1-py](https://github.com/janten/dpt-rp1-py) - Python library for Sony Digital Paper
- Flask - Web framework
- Vanilla JavaScript - No frameworks, just pure awesome! 💪

---

Made with ✨ and 💜 for Sony Digital Paper users
