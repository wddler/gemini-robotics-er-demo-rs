// Capture image as base64 from current preview/canvas/video
function getImageBase64() {
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

let currentImageWidth = 640;
let currentImageHeight = 480;

// Send to Gemini with image and text
document.getElementById('sendBtn').addEventListener('click', async function () {
    const prompt = document.getElementById('message').value || '';
    const responseEl = document.getElementById('response');
    const resultsDiv = document.getElementById('results');
    const resultsJson = document.getElementById('resultsJson');
    
    responseEl.textContent = 'Getting image...';
    
    try {
        const imageBase64 = await getImageBase64();
        if (!imageBase64) {
            responseEl.textContent = 'No image available';
            return;
        }
        
        responseEl.textContent = 'Sending to Gemini...';
        
        const res = await fetch('/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: imageBase64,
                prompt: prompt
            })
        });
        
        const text = await res.text();
        responseEl.textContent = 'Response: ' + text;
        
        // Try to parse and display results
        try {
            let jsonText = text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.slice(7);
            }
            if (jsonText.endsWith('```')) {
                jsonText = jsonText.slice(0, -3);
            }
            jsonText = jsonText.trim();
            const results = JSON.parse(jsonText);
            if (Array.isArray(results)) {
                resultsJson.textContent = JSON.stringify(results, null, 2);
                resultsDiv.style.display = '';
                drawDetectionPoints(results);
            }
        } catch (e) {
            // Response is not JSON, display as text
        }
    } catch (err) {
        responseEl.textContent = 'Error: ' + err.message;
    }
});

// Draw detection points and labels on overlay canvas
function drawDetectionPoints(results) {
    const canvasOverlay = document.getElementById('canvasOverlay');
    const imgPreview = document.getElementById('imgPreview');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    let targetElement;
    if (imgPreview.style.display !== 'none') {
        targetElement = imgPreview;
    } else if (video.style.display !== 'none') {
        targetElement = video;
    } else if (canvas.style.display !== 'none') {
        targetElement = canvas;
    } else {
        return;
    }
    
    const rect = targetElement.getBoundingClientRect();
    canvasOverlay.width = rect.width;
    canvasOverlay.height = rect.height;
    canvasOverlay.style.display = '';
    canvasOverlay.style.left = rect.left + 'px';
    canvasOverlay.style.top = rect.top + 'px';
    
    const ctx = canvasOverlay.getContext('2d');
    ctx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    
    results.forEach(item => {
        const [y, x] = item.point;
        // Points are normalized to 0-1000
        const px = (x / 1000) * rect.width;
        const py = (y / 1000) * rect.height;
        
        // Draw circle
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw label
        ctx.fillStyle = '#FF0000';
        ctx.font = '24px Arial';
        ctx.fillText(item.label, px + 12, py - 5);
    });
}

// Hide overlay when image changes
document.getElementById('fileInput').addEventListener('change', () => {
    document.getElementById('canvasOverlay').style.display = 'none';
    document.getElementById('results').style.display = 'none';
});
document.getElementById('openCamBtn').addEventListener('click', () => {
    document.getElementById('canvasOverlay').style.display = 'none';
    document.getElementById('results').style.display = 'none';
});

// existing image upload and camera
const fileInput = document.getElementById('fileInput');
const uploadFileBtn = document.getElementById('uploadFileBtn');
const imgPreview = document.getElementById('imgPreview');
const placeholderText = document.getElementById('placeholderText');
const responseEl = document.getElementById('response');

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

// camera
const openCamBtn = document.getElementById('openCamBtn');
const captureBtn = document.getElementById('captureBtn');
const closeCamBtn = document.getElementById('closeCamBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
let stream = null;

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
