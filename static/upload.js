document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("upload-form");
    const fileInput = document.getElementById("file");
    const dropArea = document.getElementById("drop-area");
    const loader = document.getElementById("loader");
    const result = document.getElementById("result");
    const viewerLink = document.getElementById("viewer-link");
    const qrPreview = document.getElementById("qr-preview");
    const copyMessage = document.querySelector(".copy-message");
    const previewContainer = document.getElementById("preview");
  
    // 🌓 Theme toggle
    document.getElementById("toggle-theme").onclick = () => {
      document.body.classList.toggle("dark");
    };
  
    // 📁 Drag-and-drop behavior
    ['dragenter', 'dragover'].forEach(event =>
      dropArea.addEventListener(event, e => {
        e.preventDefault();
        dropArea.classList.add("dragover");
      })
    );
  
    ['dragleave', 'drop'].forEach(event =>
      dropArea.addEventListener(event, e => {
        e.preventDefault();
        dropArea.classList.remove("dragover");
      })
    );
  
    dropArea.addEventListener("click", () => fileInput.click());
  
    dropArea.addEventListener("drop", e => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        previewSTL(files[0]);
      }
    });
  
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        previewSTL(fileInput.files[0]);
      }
    });
  
    // 🎥 STL Preview Function
    function previewSTL(file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.z = 100;
  
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
        previewContainer.innerHTML = "";
        previewContainer.appendChild(renderer.domElement);
  
        const light = new THREE.AmbientLight(0xffffff, 2);
        scene.add(light);
  
        const loader = new THREE.STLLoader();
        const geometry = loader.parse(e.target.result);
        geometry.computeVertexNormals();
  
        const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
        const mesh = new THREE.Mesh(geometry, material);
  
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        mesh.position.sub(center);
        scene.add(mesh);
  
        const animate = () => {
          requestAnimationFrame(animate);
          mesh.rotation.y += 0.01;
          renderer.render(scene, camera);
        };
        animate();
      };
      reader.readAsArrayBuffer(file);
    }
  
    // 🚀 Upload + Generate QR
    form.onsubmit = async e => {
      e.preventDefault();
      if (!fileInput.files[0]) return alert("Please select an STL file");
  
      loader.hidden = false;
      result.hidden = true;
  
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);
  
      try {
        const uploadRes = await fetch("/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);
  
        const qrRes = await fetch("/generate_qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: uploadData.stl_filename }),
        });
        const qrData = await qrRes.json();
        if (!qrRes.ok) throw new Error(qrData.error);
  
        viewerLink.href = qrData.viewer_url;
        viewerLink.textContent = qrData.viewer_url;
        qrPreview.src = qrData.qr_code_path;
        result.hidden = false;
  
        navigator.clipboard.writeText(qrData.viewer_url).then(() => {
          copyMessage.hidden = false;
          setTimeout(() => (copyMessage.hidden = true), 1500);
        });
      } catch (err) {
        alert("❌ Error: " + err.message);
      } finally {
        loader.hidden = true;
      }
    };
  });
  