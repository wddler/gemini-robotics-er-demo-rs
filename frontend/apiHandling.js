// apiHandling.js - Handles sending requests to Gemini API

import { getImageBase64 } from './imageHandling.js';
import { drawDetectionPoints } from './overlay.js';

export function setupApiHandling() {
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
}