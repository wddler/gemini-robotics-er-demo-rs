// overlay.js - Handles drawing detection points and labels on overlay

// Draw detection points and labels on overlay canvas
export function drawDetectionPoints(results) {
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
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw label
        ctx.fillStyle = '#FF0000';
        ctx.font = '24px Arial';
        ctx.fillText(item.label, px + 12, py - 5);
    });
}

export function setupOverlayHandling() {
    // Hide overlay when image changes
    document.getElementById('fileInput').addEventListener('change', () => {
        document.getElementById('canvasOverlay').style.display = 'none';
        document.getElementById('results').style.display = 'none';
    });
    document.getElementById('openCamBtn').addEventListener('click', () => {
        document.getElementById('canvasOverlay').style.display = 'none';
        document.getElementById('results').style.display = 'none';
    });
}