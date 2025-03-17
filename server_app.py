import os
import qrcode
import logging
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing (CORS)

# Directories for storing files
BASE_DIR = os.getcwd()
MODEL_DIR = os.path.join(BASE_DIR, "models")
QR_DIR = os.path.join(BASE_DIR, "qr_codes")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(QR_DIR, exist_ok=True)

# Configure Flask logging
logging.basicConfig(level=logging.DEBUG)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # Set max file size to 50MB

# Upload STL file
@app.route('/upload', methods=['POST'])
def upload_file():
    logging.debug("Received upload request.")
    if 'file' not in request.files:
        logging.error("No file part in the request.")
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logging.error("No file selected.")
        return jsonify({"error": "No file selected"}), 400
    
    # Replace spaces with underscores in the filename
    filename = file.filename.replace(" ", "_")
    filepath = os.path.join(MODEL_DIR, filename)
    try:
        file.save(filepath)
        logging.debug(f"File saved at {filepath}.")
        return jsonify({"message": "File uploaded successfully", "filename": filename}), 200
    except Exception as e:
        logging.error(f"Failed to save file: {e}")
        return jsonify({"error": f"Failed to save file: {str(e)}"}), 500

# Generate QR Code for a CAD file
@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    data = request.get_json()
    filename = data.get("filename")
    if not filename:
        logging.error("Filename not provided.")
        return jsonify({"error": "Filename is required"}), 400

    # Replace spaces with underscores
    filename = filename.replace(" ", "_")
    file_path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(file_path):
        logging.error(f"File not found: {filename}")
        return jsonify({"error": f"File '{filename}' not found. Please upload the file first."}), 404

    # Detect host dynamically (useful for both local and ngrok setups)
    host_url = request.host_url.rstrip("/")  # Removes trailing slash from the host URL
    viewer_type = data.get("viewer", "standard")  # "standard" or "ar"
    if viewer_type == "ar":
        viewer_url = f"{host_url}/ar_viewer/{filename}"
    else:
        viewer_url = f"{host_url}/viewer/{filename}"

    # Generate QR code
    qr_code_path = os.path.join(QR_DIR, f"{filename}.png")
    try:
        qr = qrcode.make(viewer_url)
        qr.save(qr_code_path)
        logging.debug(f"QR code saved at {qr_code_path}.")
        return jsonify({
            "message": "QR code generated successfully",
            "viewer_url": viewer_url,
            "qr_code_path": f"{host_url}/qr_codes/{filename}.png"
        }), 200
    except Exception as e:
        logging.error(f"Failed to generate QR code: {e}")
        return jsonify({"error": f"Failed to generate QR code: {str(e)}"}), 500

# Serve STL files
@app.route('/models/<path:filename>')
def serve_file(filename):
    filename = filename.replace(" ", "_")
    file_path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(file_path):
        logging.error(f"File not found: {filename}")
        return jsonify({"error": f"File '{filename}' not found."}), 404
    return send_from_directory(MODEL_DIR, filename, mimetype='model/stl')

# Serve QR codes
@app.route('/qr_codes/<path:filename>')
def serve_qr_code(filename):
    filename = filename.replace(" ", "_")
    return send_from_directory(QR_DIR, filename)

# 3D Viewer Route
@app.route('/viewer/<path:filename>')
def viewer(filename):
    filename = filename.replace(" ", "_")
    return render_template("viewer.html", model_filename=filename)

# AR Viewer Route
@app.route('/ar_viewer/<path:filename>')
def ar_viewer(filename):
    filename = filename.replace(" ", "_")
    host_url = request.host_url.rstrip("/")
    model_url = f"{host_url}/models/{filename}"
    return render_template("ar_viewer.html", model_url=model_url)

# List all uploaded files
@app.route('/list_files', methods=['GET'])
def list_files():
    try:
        files = os.listdir(MODEL_DIR)
        logging.debug(f"Files in models directory: {files}")
        return jsonify({"files": files}), 200
    except Exception as e:
        logging.error(f"Failed to list files: {e}")
        return jsonify({"error": f"Failed to list files: {str(e)}"}), 500

# Camera Viewer Route (Optional Placeholder)
@app.route('/camera_viewer')
def camera_viewer():
    return render_template('camera_viewer.html')

# Run the app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
