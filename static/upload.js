function toggleTheme() {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "light" ? "dark" : "light";
}

const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("fileInput");

// Drag & drop
dropArea.addEventListener("click", () => fileInput.click());
dropArea.addEventListener("dragover", e => {
    e.preventDefault();
    dropArea.classList.add("highlight");
});
dropArea.addEventListener("dragleave", () => dropArea.classList.remove("highlight"));
dropArea.addEventListener("drop", e => {
    e.preventDefault();
    dropArea.classList.remove("highlight");
    const files = e.dataTransfer.files;
    if (files.length) {
        fileInput.files = files;
        if (files[0].name.toLowerCase().endsWith(".stl")) {
            previewSTL(files[0]);
        }
    }
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file && file.name.toLowerCase().endsWith(".stl")) {
        previewSTL(file);
    }
});

async function previewSTL(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const scene = new THREE.Scene();
        const container = document.getElementById("stl-preview");
        container.innerHTML = "";

        const width = container.clientWidth;
        const height = container.clientHeight;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        scene.add(light);

        const loader = new THREE.STLLoader();
        const geometry = loader.parse(e.target.result);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
        const mesh = new THREE.Mesh(geometry, material);

        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);

        const group = new THREE.Group();
        group.add(mesh);
        scene.add(group);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const distance = maxDim / (2 * Math.tan(fov / 2));
        camera.position.set(0, 0, distance * 1.5);
        camera.lookAt(0, 0, 0);

        window.addEventListener("resize", () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        });

        function animate() {
            requestAnimationFrame(animate);
            group.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        animate();
    };
    reader.readAsArrayBuffer(file);
}

document.getElementById("uploadForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;

    const status = document.getElementById("statusText");
    const spinner = document.getElementById("loadingSpinner");
    const linkContainer = document.getElementById("linkContainer");
    const viewerType = document.querySelector('input[name="viewerType"]:checked').value;

    status.textContent = "Uploading and processing...";
    spinner.style.display = "block";
    linkContainer.style.display = "none";

    try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);

        const filename = uploadData.stl_filename;

        const qrRes = await fetch("/generate_qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, viewer: viewerType }),
        });

        const qrData = await qrRes.json();
        if (!qrRes.ok) throw new Error(qrData.error);

        document.getElementById("viewerLink").href = qrData.viewer_url;
        document.getElementById("viewerLink").textContent = "Click to View in 3D";
        document.getElementById("qrImage").src = qrData.qr_code_path;

        status.textContent = "Success! STL processed.";
        linkContainer.style.display = "block";

        // Show preview if server returned STL filename
        if (filename.toLowerCase().endsWith(".stl")) {
            const previewRes = await fetch(`/models/${filename}`);
            const buffer = await previewRes.arrayBuffer();
            previewSTL(new File([buffer], filename));
        }
    } catch (err) {
        status.textContent = "❌ Error: " + err.message;
    } finally {
        spinner.style.display = "none";
    }
});
