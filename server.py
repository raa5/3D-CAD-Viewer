import os
import qrcode
import logging
import meshio
import trimesh
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

BASE_DIR = os.getcwd()
MODEL_DIR = os.path.join(BASE_DIR, "models")
QR_DIR = os.path.join(BASE_DIR, "qr_codes")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(QR_DIR, exist_ok=True)

app.config['MAX_CONTENT_LENGTH'] = 150 * 1024 * 1024  # 150MB
logging.basicConfig(level=logging.DEBUG)

def convert_stl_to_glb(input_stl, output_glb):
    try:
        ply_path = input_stl.replace(".stl", ".ply")
        mesh = meshio.read(input_stl)
        meshio.write(ply_path, mesh)
        mesh = trimesh.load(ply_path)
        mesh.export(output_glb, file_type="glb")
        return True
    except Exception as e:
        logging.error(f"Conversion failed: {e}")
        return False

@app.route('/')
def index():
    return render_template("upload.html")

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    filename = file.filename.replace(" ", "_")
    stl_path = os.path.join(MODEL_DIR, filename)
    file.save(stl_path)

    glb_filename = filename.replace('.stl', '.glb')
    glb_path = os.path.join(MODEL_DIR, glb_filename)
    if convert_stl_to_glb(stl_path, glb_path):
        return jsonify({'stl': filename, 'glb': glb_filename}), 200
    else:
        return jsonify({'error': 'Conversion failed'}), 500

@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    data = request.get_json()
    filename = data.get("filename")
    viewer = data.get("viewer", "standard")

    if not filename:
        return jsonify({"error": "Filename is required"}), 400

    host_url = request.host_url.rstrip('/')
    view_url = f"{host_url}/viewer/{filename}" if viewer == "standard" else f"{host_url}/ar_viewer/{filename.replace('.stl', '.glb')}"
    qr_path = os.path.join(QR_DIR, f"{filename}.png")

    qrcode.make(view_url).save(qr_path)
    return jsonify({"url": view_url, "qr": f"{host_url}/qr_codes/{filename}.png"})

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
    return render_template("ar_viewer.html", model_url=f"/models/{filename}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Railway injects PORT
    app.run(debug=False, host="0.0.0.0", port=port)
