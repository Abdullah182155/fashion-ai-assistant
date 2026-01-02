/**
 * Fashion AI Chatbot - Frontend Server
 * Express server to serve static files and proxy API requests
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api'
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(502).json({ error: 'Backend unavailable' });
    }
}));

// Proxy image requests to backend
app.use('/images', createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve embed.js for external websites
app.get('/embed.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'embed.js'));
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🎨 FASHION AI CHATBOT - FRONTEND SERVER');
    console.log('='.repeat(60));
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Backend:  ${BACKEND_URL}`);
    console.log('='.repeat(60));
    console.log('\n📝 To embed on any website, add this script:');
    console.log(`   <script src="http://localhost:${PORT}/embed.js"></script>\n`);
});
