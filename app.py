#!/usr/bin/env python3
"""
Sony Digital Paper Web GUI - Flask Backend
A sassy web-based file manager for Sony Digital Paper devices
"""

from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import os
import io
from pathlib import Path
from dptrp1.dptrp1 import DigitalPaper, find_auth_files

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / 'static'

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path='/static')
CORS(app)

# Global device instance
device = None
device_connected = False

# Default local directory to browse (user's home)
DEFAULT_LOCAL_PATH = str(Path.home())


@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory(str(STATIC_DIR), 'index.html')


@app.route('/api/device/connect', methods=['GET'])
def connect_device():
    """Connect to the Digital Paper device using auto-discovery"""
    global device, device_connected
    
    try:
        # Find authentication files
        deviceid_path, privatekey_path = find_auth_files()
        
        if not os.path.exists(deviceid_path) or not os.path.exists(privatekey_path):
            return jsonify({
                'success': False,
                'error': 'Authentication files not found. Please run "dptrp1 register" first! 📝'
            }), 400
        
        # Read credentials
        with open(deviceid_path) as f:
            client_id = f.readline().strip()
        with open(privatekey_path, 'rb') as f:
            key = f.read()
        
        # Create device instance with auto-discovery (no addr specified)
        # assume_yes=True to skip interactive prompts during sync
        device = DigitalPaper(quiet=False, assume_yes=True)
        device.authenticate(client_id, key)
        
        # Test connection by getting device info
        info = device.get_info()
        device_connected = True
        
        return jsonify({
            'success': True,
            'message': '✨ Connected to your Digital Paper! ✨',
            'info': info
        })
        
    except Exception as e:
        device_connected = False
        return jsonify({
            'success': False,
            'error': f'Oops! Connection failed: {str(e)} 😢'
        }), 500


@app.route('/api/device/info', methods=['GET'])
def get_device_info():
    """Get device information (battery, storage, etc.)"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    try:
        info = device.get_info()
        battery = device.get_battery()
        storage = device.get_storage()
        
        # Debug log to see actual response format
        print(f"Battery response: {battery}")
        print(f"Storage response: {storage}")
        
        return jsonify({
            'success': True,
            'info': info,
            'battery': battery,
            'storage': storage
        })
    except Exception as e:
        print(f"Error getting device info: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/list', methods=['GET'])
def list_device_files():
    """List files and folders on the device"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    path = request.args.get('path', 'Document')
    
    try:
        entries = device.list_objects_in_folder(path)
        
        # Format entries for frontend
        files = []
        folders = []
        
        for entry in entries:
            item = {
                'name': entry.get('entry_name', ''),
                'path': entry.get('entry_path', ''),
                'type': entry.get('entry_type', ''),
                'id': entry.get('entry_id', ''),
                'size': entry.get('file_size', 0),
                'modified': entry.get('modified_date', '')
            }
            
            if entry.get('entry_type') == 'folder':
                folders.append(item)
            else:
                files.append(item)
        
        return jsonify({
            'success': True,
            'path': path,
            'folders': sorted(folders, key=lambda x: x['name'].lower()),
            'files': sorted(files, key=lambda x: x['name'].lower())
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/local/list', methods=['GET'])
def list_local_files():
    """List files and folders on local filesystem"""
    path = request.args.get('path', DEFAULT_LOCAL_PATH)
    
    try:
        # Resolve and validate path
        path = os.path.expanduser(path)
        path = os.path.abspath(path)
        
        if not os.path.exists(path) or not os.path.isdir(path):
            return jsonify({'success': False, 'error': 'Invalid path! 🗂️'}), 400
        
        entries = os.listdir(path)
        files = []
        folders = []
        
        for entry in entries:
            # Skip hidden files
            if entry.startswith('.'):
                continue
            
            full_path = os.path.join(path, entry)
            
            try:
                stat = os.stat(full_path)
                item = {
                    'name': entry,
                    'path': full_path,
                    'size': stat.st_size,
                    'modified': stat.st_mtime
                }
                
                if os.path.isdir(full_path):
                    folders.append(item)
                else:
                    files.append(item)
            except (PermissionError, OSError):
                # Skip files we can't access
                continue
        
        return jsonify({
            'success': True,
            'path': path,
            'folders': sorted(folders, key=lambda x: x['name'].lower()),
            'files': sorted(files, key=lambda x: x['name'].lower())
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/upload', methods=['POST'])
def upload_to_device():
    """Upload file(s) to the device"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    try:
        files = request.files.getlist('files')
        remote_path = request.form.get('remote_path', 'Document')
        
        if not files:
            return jsonify({'success': False, 'error': 'No files provided! 📄'}), 400
        
        uploaded = []
        for file in files:
            if file.filename:
                # Upload file
                dest_path = f"{remote_path}/{file.filename}"
                device.upload(file.stream, dest_path)
                uploaded.append(file.filename)
        
        return jsonify({
            'success': True,
            'message': f'✨ Uploaded {len(uploaded)} file(s)! ✨',
            'files': uploaded
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/download', methods=['POST'])
def download_from_device():
    """Download file(s) from the device to a local folder"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    remote_paths = data.get('paths', [])
    local_folder = data.get('local_folder', str(Path.home() / 'Downloads'))
    
    if not remote_paths:
        return jsonify({'success': False, 'error': 'No paths provided! 📄'}), 400
    
    try:
        downloaded = []
        for remote_path in remote_paths:
            # Download file data
            file_data = device.download(remote_path)
            filename = os.path.basename(remote_path)
            local_path = os.path.join(local_folder, filename)
            
            # Save to local folder
            with open(local_path, 'wb') as f:
                f.write(file_data)
            
            downloaded.append(filename)
        
        return jsonify({
            'success': True,
            'message': f'📥 Downloaded {len(downloaded)} file(s) to {local_folder}!',
            'files': downloaded
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/delete', methods=['DELETE'])
def delete_from_device():
    """Delete file(s) or folder(s) from the device"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    paths = data.get('paths', [])
    
    if not paths:
        return jsonify({'success': False, 'error': 'No paths provided! 📄'}), 400
    
    try:
        deleted = []
        for path in paths:
            # Check if it's a folder or file
            if device.path_is_folder(path):
                device.delete_folder(path)
            else:
                device.delete_document(path)
            deleted.append(path)
        
        return jsonify({
            'success': True,
            'message': f'🗑️ Deleted {len(deleted)} item(s)!',
            'deleted': deleted
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/folder', methods=['POST'])
def create_folder():
    """Create a new folder on the device"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    path = data.get('path')
    
    if not path:
        return jsonify({'success': False, 'error': 'No path provided! 📁'}), 400
    
    try:
        device.new_folder(path)
        return jsonify({
            'success': True,
            'message': f'📁 Created folder: {os.path.basename(path)}!'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/move', methods=['POST'])
def move_file():
    """Move/rename a file on the device"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    old_path = data.get('old_path')
    new_path = data.get('new_path')
    
    if not old_path or not new_path:
        return jsonify({'success': False, 'error': 'Paths not provided! 📄'}), 400
    
    try:
        device.move_file(old_path, new_path)
        return jsonify({
            'success': True,
            'message': '✨ File moved successfully!'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sync', methods=['POST'])
def download_all_from_device():
    """Download ALL files from the device to local folder (skips existing files)"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    local_folder = data.get('local_folder')
    
    if not local_folder:
        return jsonify({'success': False, 'error': 'No local folder provided! 📁'}), 400
    
    try:
        print(f"📥 Downloading ALL from device to: {local_folder}")
        
        # Get all documents from device
        all_items = device.list_all()
        documents = [item for item in all_items if item.get('entry_type') == 'document']
        
        total = len(documents)
        downloaded = 0
        skipped = 0
        
        for item in documents:
            remote_path = item.get('entry_path', '')
            
            # Calculate local path preserving folder structure
            if remote_path.startswith('Document/'):
                rel_path = remote_path[len('Document/'):]
            else:
                rel_path = remote_path
            
            local_path = os.path.join(local_folder, rel_path)
            local_dir = os.path.dirname(local_path)
            
            # Skip if file already exists locally
            if os.path.exists(local_path):
                skipped += 1
                print(f"⏭️ Skipped (exists): {rel_path}")
                continue
            
            # Create directories if needed
            if local_dir and not os.path.exists(local_dir):
                os.makedirs(local_dir, exist_ok=True)
            
            # Download and save
            try:
                file_data = device.download(remote_path)
                with open(local_path, 'wb') as f:
                    f.write(file_data)
                downloaded += 1
                print(f"📥 [{downloaded}/{total-skipped}] {rel_path}")
            except Exception as e:
                print(f"⚠️ Failed to download {remote_path}: {e}")
        
        print(f"✅ Download complete: {downloaded} new, {skipped} skipped")
        
        return jsonify({
            'success': True,
            'message': f'📥 Downloaded {downloaded} files ({skipped} already existed)',
            'downloaded': downloaded,
            'skipped': skipped,
            'total': total
        })
        
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/upload-all', methods=['POST'])
def upload_all_to_device():
    """Upload ALL PDFs from local folder to device (skips existing files)"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    local_folder = data.get('local_folder')
    
    if not local_folder:
        return jsonify({'success': False, 'error': 'No local folder provided! 📁'}), 400
    
    try:
        print(f"📤 Uploading ALL from {local_folder} to device")
        
        # Get list of existing files on device
        all_device_items = device.list_all()
        device_files = set()
        for item in all_device_items:
            if item.get('entry_type') == 'document':
                path = item.get('entry_path', '')
                if path.startswith('Document/'):
                    device_files.add(path[len('Document/'):])
        
        # Find all PDF files in local folder recursively
        import glob
        local_pdfs = glob.glob(os.path.join(local_folder, '**/*.pdf'), recursive=True)
        
        total = len(local_pdfs)
        uploaded = 0
        skipped = 0
        
        for local_path in local_pdfs:
            # Calculate relative path
            rel_path = os.path.relpath(local_path, local_folder)
            remote_path = f"Document/{rel_path}"
            
            # Skip if file already exists on device
            if rel_path in device_files:
                skipped += 1
                print(f"⏭️ Skipped (exists): {rel_path}")
                continue
            
            # Upload file
            try:
                with open(local_path, 'rb') as f:
                    device.upload(f, remote_path)
                uploaded += 1
                print(f"📤 [{uploaded}/{total-skipped}] {rel_path}")
            except Exception as e:
                print(f"⚠️ Failed to upload {rel_path}: {e}")
        
        print(f"✅ Upload complete: {uploaded} new, {skipped} skipped")
        
        return jsonify({
            'success': True,
            'message': f'📤 Uploaded {uploaded} files ({skipped} already existed)',
            'uploaded': uploaded,
            'skipped': skipped,
            'total': total
        })
        
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sync-to-device', methods=['POST'])
def sync_to_device():
    """Sync local folder TO device (local is source of truth - uploads new, deletes on device if not in local)"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    local_folder = data.get('local_folder')
    
    if not local_folder:
        return jsonify({'success': False, 'error': 'No local folder provided! 📁'}), 400
    
    try:
        print(f"🔄 Syncing {local_folder} TO device (local is source of truth)")
        
        # Get list of existing files on device
        all_device_items = device.list_all()
        device_files = {}
        for item in all_device_items:
            if item.get('entry_type') == 'document':
                path = item.get('entry_path', '')
                if path.startswith('Document/'):
                    rel = path[len('Document/'):]
                    device_files[rel] = path
        
        # Find all PDF files in local folder recursively
        import glob
        local_pdfs = glob.glob(os.path.join(local_folder, '**/*.pdf'), recursive=True)
        local_files = set()
        for local_path in local_pdfs:
            rel_path = os.path.relpath(local_path, local_folder)
            local_files.add(rel_path)
        
        uploaded = 0
        deleted = 0
        skipped = 0
        
        # Upload files that are in local but not on device
        for local_path in local_pdfs:
            rel_path = os.path.relpath(local_path, local_folder)
            
            if rel_path in device_files:
                skipped += 1
                continue
            
            remote_path = f"Document/{rel_path}"
            try:
                with open(local_path, 'rb') as f:
                    device.upload(f, remote_path)
                uploaded += 1
                print(f"📤 Uploaded: {rel_path}")
            except Exception as e:
                print(f"⚠️ Failed to upload {rel_path}: {e}")
        
        # Delete files on device that are not in local
        for rel_path, full_path in device_files.items():
            if rel_path not in local_files:
                try:
                    device.delete_document(full_path)
                    deleted += 1
                    print(f"🗑️ Deleted from device: {rel_path}")
                except Exception as e:
                    print(f"⚠️ Failed to delete {rel_path}: {e}")
        
        print(f"✅ Sync complete: {uploaded} uploaded, {deleted} deleted, {skipped} unchanged")
        
        return jsonify({
            'success': True,
            'message': f'🔄 Synced! {uploaded} uploaded, {deleted} deleted from device',
            'uploaded': uploaded,
            'deleted': deleted,
            'skipped': skipped
        })
        
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/device/download-recursive', methods=['POST'])
def download_recursive():
    """Download files/folders recursively from device, preserving folder structure"""
    if not device_connected or not device:
        return jsonify({'success': False, 'error': 'Device not connected! 🔌'}), 400
    
    data = request.get_json()
    remote_paths = data.get('paths', [])
    local_folder = data.get('local_folder')
    
    if not remote_paths or not local_folder:
        return jsonify({'success': False, 'error': 'Missing paths or destination! 📄'}), 400
    
    try:
        downloaded = []
        total_files = 0
        
        for remote_path in remote_paths:
            # Check if it's a folder
            if device.path_is_folder(remote_path):
                # Recursively download folder
                folder_name = os.path.basename(remote_path)
                local_dest = os.path.join(local_folder, folder_name)
                os.makedirs(local_dest, exist_ok=True)
                
                # Get all items in folder recursively
                items = device.traverse_folder_recursively(remote_path)
                for item in items:
                    if item.get('entry_type') == 'document':
                        item_path = item.get('entry_path')
                        # Calculate relative path from remote_path
                        rel_path = item_path[len(remote_path):].lstrip('/')
                        local_item_path = os.path.join(local_dest, rel_path)
                        
                        # Create parent directories
                        os.makedirs(os.path.dirname(local_item_path), exist_ok=True)
                        
                        # Download file
                        file_data = device.download(item_path)
                        with open(local_item_path, 'wb') as f:
                            f.write(file_data)
                        
                        total_files += 1
                        print(f"📥 Downloaded: {item_path}")
                
                downloaded.append(folder_name)
            else:
                # Single file download
                file_data = device.download(remote_path)
                filename = os.path.basename(remote_path)
                local_path = os.path.join(local_folder, filename)
                
                with open(local_path, 'wb') as f:
                    f.write(file_data)
                
                downloaded.append(filename)
                total_files += 1
                print(f"📥 Downloaded: {remote_path}")
        
        return jsonify({
            'success': True,
            'message': f'📥 Downloaded {total_files} file(s) to {local_folder}!',
            'files': downloaded,
            'total': total_files
        })
        
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def main():
    """Main entry point for the application"""
    print("🎨 Starting Sony Digital Paper Web GUI...")
    print("📱 Open your browser to: http://localhost:5001")
    print("✨ Let's manage some files! ✨\n")
    app.run(debug=True, host='0.0.0.0', port=5001)


if __name__ == '__main__':
    main()

