document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("upload-form");
    const fileInput = document.getElementById("file");
    const dropArea = document.getElementById("drop-area");
    const loader = document.getElementById("loader");
    const result = document.getElementById("result");
    const viewerLink = document.getElementById("viewer-link");
    const qrPreview = document.getElementById("qr-preview");
    const copyMessage = document.querySelector(".copy-message");

    // 🌙 Theme toggle
    document.getElementById("toggle-theme").onclick = () => {
        document.body.classList.toggle("dark");
    };

    // 🔍 "Browse" click triggers file input
    document.querySelector(".browse").addEventListener("click", () => {
        fileInput.click();
    });

    // 🎯 STL preview when file selected
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (file) {
            previewSTL(file);
        }
    });

    // 📂 Drag and drop handlers
    ['dragenter', 'dragover'].forEach(event => {
        dropArea.addEventListener(event, e => {
            e.preventDefault();
            dropArea.classList.add("dragover");
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        dropArea.addEventListener(event, e => {
            e.preventDefault();
            dropArea.classList.remove("dragover");
        });
    });

    dropArea.addEventListener("drop", e => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event("change"));
        }
    });

    // 🚀 Upload and generate QR code
    form.onsubmit = async (e) => {
        e.preventDefault();
        loader.hidden = false;
        result.hidden = true;

        const formData = new FormData(form);
        try {
            const uploadRes = await fetch("/upload", { method: "POST", body: formData });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error);

            const qrRes = await fetch("/generate_qr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: uploadData.stl_filename || uploadData.stl })
            });
            const qrData = await qrRes.json();
            if (!qrRes.ok) throw new Error(qrData.error);

            // ✨ Show result
            viewerLink.textContent = qrData.viewer_url || qrData.url;
            viewerLink.href = qrData.viewer_url || qrData.url;
            qrPreview.src = qrData.qr_code_path || qrData.qr;
            result.hidden = false;

            // 📋 Auto-copy link to clipboard
            navigator.clipboard.writeText(viewerLink.href).then(() => {
                copyMessage.hidden = false;
                setTimeout(() => copyMessage.hidden = true, 2000);
            });
        } catch (err) {
            alert("❌ " + err.message);
        } finally {
            loader.hidden = true;
        }
    };

    // 🧱 STL Preview Viewer
    function previewSTL(file) {
        const preview = document.getElementById("preview");
        const reader = new FileReader();

        reader.onload = function (e) {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, preview.clientWidth / preview.clientHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(preview.clientWidth, preview.clientHeight);
            preview.innerHTML = "";
            preview.appendChild(renderer.domElement);

            const light = new THREE.AmbientLight(0xffffff, 2);
            scene.add(light);

            const loader = new THREE.STLLoader();
            const geometry = loader.parse(e.target.result);
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);

            // Center object
            const box = new THREE.Box3().setFromObject(mesh);
            const center = box.getCenter(new THREE.Vector3());
            mesh.position.sub(center);

            // Camera setup
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            camera.position.set(0, 0, maxDim * 2);

            // Animation loop
            const animate = function () {
                requestAnimationFrame(animate);
                mesh.rotation.y += 0.01;
                renderer.render(scene, camera);
            };
            animate();
        };

        reader.readAsArrayBuffer(file);
    }
});
