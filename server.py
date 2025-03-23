import os
import qrcode
import logging
import meshio
import trimesh
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.getcwd()
MODEL_DIR = os.path.join(BASE_DIR, "models")
QR_DIR = os.path.join(BASE_DIR, "qr_codes")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(QR_DIR, exist_ok=True)

logging.basicConfig(level=logging.DEBUG)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # Up to 500MB

def convert_stl_to_glb(input_stl, output_glb):
    try:
        ply_path = input_stl.replace('.stl', '.ply')
        mesh = meshio.read(input_stl)
        meshio.write(ply_path, mesh)
        logging.info(f"Converted STL to PLY: {ply_path}")

        mesh_trimesh = trimesh.load_mesh(ply_path)
        mesh_trimesh.export(output_glb, file_type='glb')
        logging.info(f"Converted PLY to GLB: {output_glb}")
        return True
    except Exception as e:
        logging.error(f"STL to GLB conversion failed: {e}")
        return False

@app.route('/')
def home():
    return render_template("upload.html")

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filename = file.filename.replace(" ", "_")
    stl_path = os.path.join(MODEL_DIR, filename)
    file.save(stl_path)

    glb_filename = filename.replace('.stl', '.glb')
    glb_path = os.path.join(MODEL_DIR, glb_filename)

    if convert_stl_to_glb(stl_path, glb_path):
        return jsonify({"message": "File uploaded and converted", "stl_filename": filename, "glb_filename": glb_filename}), 200
    else:
        return jsonify({"error": "Conversion failed"}), 500

@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    data = request.get_json()
    filename = data.get("filename")
    viewer = data.get("viewer", "standard")

    if not filename:
        return jsonify({"error": "Filename required"}), 400

    filename = filename.replace(" ", "_")
    file_path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File does not exist"}), 404

    host = request.host_url.rstrip("/")
    if viewer == "ar":
        qr_link = f"{host}/ar_viewer/{filename.replace('.stl', '.glb')}"
    else:
        qr_link = f"{host}/viewer/{filename}"

    qr_path = os.path.join(QR_DIR, f"{filename}.png")
    qrcode.make(qr_link).save(qr_path)

    return jsonify({
        "message": "QR created",
        "viewer_url": qr_link,
        "qr_code_path": f"{host}/qr_codes/{filename}.png"
    })

@app.route('/models/<path:filename>')
def serve_model(filename):
    return send_from_directory(MODEL_DIR, filename)

@app.route('/qr_codes/<path:filename>')
def serve_qr(filename):
    return send_from_directory(QR_DIR, filename)

@app.route('/viewer/<path:filename>')
def viewer(filename):
    return render_template("viewer.html", model_filename=filename)

@app.route('/ar_viewer/<path:filename>')
def ar_viewer(filename):
    model_url = f"{request.host_url.rstrip('/')}/models/{filename}"
    return render_template("ar_viewer.html", model_url=model_url)

@app.route('/list_files')
def list_files():
    return jsonify({"files": os.listdir(MODEL_DIR)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
