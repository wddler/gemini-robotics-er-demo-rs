// app.js - Main entry point for the application

import { setupImageHandling } from './imageHandling.js';
import { setupApiHandling } from './apiHandling.js';
import { setupOverlayHandling } from './overlay.js';

// Initialize all modules
setupImageHandling();
setupApiHandling();
setupOverlayHandling();
