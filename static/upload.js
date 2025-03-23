document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("file");
  const dropArea = document.getElementById("drop-area");
  const loader = document.getElementById("loader");
  const result = document.getElementById("result");
  const viewerLink = document.getElementById("viewer-link");
  const qrPreview = document.getElementById("qr-preview");

  // Theme toggle
  document.getElementById("toggle-theme").onclick = () => {
    document.documentElement.classList.toggle("dark");
    document.documentElement.classList.toggle("light");
  };

  // STL preview (filename only for now)
  fileInput.addEventListener("change", () => {
    const preview = document.getElementById("preview");
    if (fileInput.files.length > 0) {
      preview.innerHTML = `📦 File: ${fileInput.files[0].name}`;
    }
  });

  // Drag and drop behavior
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

  // Upload + QR Generation
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
        body: JSON.stringify({ filename: uploadData.stl_filename })
      });
      const qrData = await qrRes.json();
      if (!qrRes.ok) throw new Error(qrData.error);

      viewerLink.textContent = qrData.viewer_url;
      viewerLink.href = qrData.viewer_url;
      qrPreview.src = qrData.qr_code_path;
      result.hidden = false;
      navigator.clipboard.writeText(qrData.viewer_url);
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      loader.hidden = true;
    }
  };
});
