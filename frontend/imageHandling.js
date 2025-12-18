// imageHandling.js - Handles image capture, upload, and camera functionality

let currentImageWidth = 640;
let currentImageHeight = 480;

// Capture image as base64 from current preview/canvas/video
export function getImageBase64() {
    const imgPreview = document.getElementById('imgPreview');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    if (imgPreview.style.display !== 'none' && imgPreview.src) {
        // Image from file upload - fetch and convert to base64
        return fetch(imgPreview.src)
            .then(res => res.blob())
            .then(blob => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            }))
            .catch(() => null);
    } else if (video.style.display !== 'none' || canvas.style.display !== 'none') {
        // Capture from canvas (video or drawn canvas)
        const ctx = canvas.getContext('2d');
        if (video.style.display !== 'none') {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            }, 'image/png');
        });
    }
    return Promise.resolve(null);
}

export function setupImageHandling() {
    const fileInput = document.getElementById('fileInput');
    const uploadFileBtn = document.getElementById('uploadFileBtn');
    const imgPreview = document.getElementById('imgPreview');
    const placeholderText = document.getElementById('placeholderText');
    const responseEl = document.getElementById('response');
    const openCamBtn = document.getElementById('openCamBtn');
    const captureBtn = document.getElementById('captureBtn');
    const closeCamBtn = document.getElementById('closeCamBtn');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    let stream = null;

    fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        imgPreview.src = url;
        imgPreview.onload = () => {
            currentImageWidth = imgPreview.naturalWidth;
            currentImageHeight = imgPreview.naturalHeight;
        };
        imgPreview.style.display = '';
        placeholderText.style.display = 'none';
        document.getElementById('video').style.display = 'none';
        document.getElementById('canvas').style.display = 'none';
    });

    uploadFileBtn.addEventListener('click', async () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) { responseEl.textContent = 'No file selected'; return; }
        try {
            const res = await fetch('/upload', { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f });
            responseEl.textContent = await res.text();
        } catch (e) {
            responseEl.textContent = 'Upload failed';
        }
    });

    openCamBtn.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            video.style.display = '';
            captureBtn.style.display = '';
            closeCamBtn.style.display = '';
            placeholderText.style.display = 'none';
            imgPreview.style.display = 'none';
            currentImageWidth = 640;
            currentImageHeight = 480;
        } catch (e) {
            responseEl.textContent = 'Camera access denied or not available';
        }
    });

    captureBtn.addEventListener('click', async () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.style.display = '';
        imgPreview.style.display = 'none';
        // convert to blob and upload
        canvas.toBlob(async (blob) => {
            if (!blob) { responseEl.textContent = 'Capture failed'; return; }
            try {
                const res = await fetch('/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
                responseEl.textContent = await res.text();
                // show preview
                const url = URL.createObjectURL(blob);
                imgPreview.src = url; imgPreview.style.display = ''; canvas.style.display = 'none';
            } catch (e) { responseEl.textContent = 'Upload failed'; }
        }, 'image/png');
    });

    closeCamBtn.addEventListener('click', () => {
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        video.style.display = 'none';
        captureBtn.style.display = 'none';
        closeCamBtn.style.display = 'none';
        placeholderText.style.display = '';
    });
}