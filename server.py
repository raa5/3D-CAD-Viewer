import os
import qrcode
import logging
import meshio
import trimesh
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS

# Directories for storing files
BASE_DIR = os.getcwd()
MODEL_DIR = os.path.join(BASE_DIR, "models")
QR_DIR = os.path.join(BASE_DIR, "qr_codes")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(QR_DIR, exist_ok=True)

# Configure Flask logging
logging.basicConfig(level=logging.DEBUG)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024 * 1024  # Accept files up to 20GB

# Helper: Convert STL to GLB using meshio and trimesh
def convert_stl_to_glb(input_stl, output_glb):
    try:
        ply_filename = input_stl.replace(".stl", ".ply")
        mesh = meshio.read(input_stl)
        meshio.write(ply_filename, mesh)
        logging.info(f"Converted STL to PLY: {ply_filename}")

        mesh = trimesh.load_mesh(ply_filename)
        mesh.export(output_glb, file_type='glb')
        logging.info(f"Converted PLY to GLB: {output_glb}")
        return True
    except Exception as e:
        logging.error(f"STL to GLB conversion failed: {e}")
        return False

# Homepage upload form
@app.route('/')
def home():
    return render_template('upload.html')

# Upload endpoint
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    filename = file.filename.replace(" ", "_")
    stl_path = os.path.join(MODEL_DIR, filename)

    # Save STL file in chunks (safe for large files)
    with open(stl_path, "wb") as f:
        for chunk in file.stream:
            f.write(chunk)

    glb_filename = filename.replace(".stl", ".glb")
    glb_path = os.path.join(MODEL_DIR, glb_filename)

    if convert_stl_to_glb(stl_path, glb_path):
        return jsonify({
            "message": "File uploaded and converted",
            "stl_filename": filename,
            "glb_filename": glb_filename
        }), 200
    else:
        return jsonify({"error": "STL to GLB conversion failed"}), 500

# Generate QR
@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    data = request.get_json()
    filename = data.get("filename")
    if not filename:
        return jsonify({"error": "Filename is required"}), 400

    filename = filename.replace(" ", "_")
    file_path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": f"File '{filename}' not found."}), 404

    host_url = request.host_url.rstrip("/")
    viewer_type = data.get("viewer", "standard")
    if viewer_type == "ar":
        viewer_url = f"{host_url}/ar_viewer/{filename.replace('.stl', '.glb')}"
    else:
        viewer_url = f"{host_url}/viewer/{filename}"

    qr_code_path = os.path.join(QR_DIR, f"{filename}.png")
    qr = qrcode.make(viewer_url)
    qr.save(qr_code_path)

    return jsonify({
        "message": "QR generated",
        "viewer_url": viewer_url,
        "qr_code_path": f"{host_url}/qr_codes/{filename}.png"
    }), 200

# Serve STL/GLB files
@app.route('/models/<path:filename>')
def serve_model(filename):
    return send_from_directory(MODEL_DIR, filename)

# Serve QR image
@app.route('/qr_codes/<path:filename>')
def serve_qr(filename):
    return send_from_directory(QR_DIR, filename)

# Viewer route
@app.route('/viewer/<path:filename>')
def viewer(filename):
    return render_template('viewer.html', model_filename=filename)

# AR viewer route
@app.route('/ar_viewer/<path:filename>')
def ar_viewer(filename):
    host_url = request.host_url.rstrip("/")
    model_url = f"{host_url}/models/{filename}"
    return render_template("ar_viewer.html", model_url=model_url)

# File listing (optional)
@app.route('/list_files')
def list_files():
    try:
        return jsonify({"files": os.listdir(MODEL_DIR)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run app
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)