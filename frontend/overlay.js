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
    // Since canvasOverlay is now inside the #placeholder container which is relative,
    // we should validly align it to the target element's offset within that container.
    // However, both video/img and canvasOverlay are children of #placeholder.
    // So top/left should likely be 0 if they fill the container, or match the element's offset.
    // The targetElement (img/video) is centered in #placeholder.
    canvasOverlay.style.left = targetElement.offsetLeft + 'px';
    canvasOverlay.style.top = targetElement.offsetTop + 'px';

    const ctx = canvasOverlay.getContext('2d');
    ctx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    results.forEach(item => {
        const [y, x] = item.point;
        // Points are normalized to 0-1000
        // Points are normalized to 0-1000
        const px = (x / 1000) * canvasOverlay.width;
        const py = (y / 1000) * canvasOverlay.height;

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