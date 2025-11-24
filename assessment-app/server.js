const express = require('express');
const path = require('path');
const cors = require('cors');
const { handler: generateReportHandler } = require('./netlify/functions/generateReport');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "font-src 'self' data:; " +
        "img-src 'self' data:; " +
        "connect-src 'self'"
    );
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes - Convert Netlify function to Express route
app.post('/api/generateReport', async (req, res) => {
    try {
        // Transform Express request to Netlify function format
        const netlifyEvent = {
            httpMethod: 'POST',
            headers: req.headers,
            body: JSON.stringify(req.body),
            queryStringParameters: req.query,
            pathParameters: null,
            requestContext: {
                requestId: req.ip + '-' + Date.now(),
                identity: {
                    sourceIp: req.ip
                }
            }
        };

        // Call the Netlify function
        const result = await generateReportHandler(netlifyEvent, {});

        // Transform response back to Express format
        res.status(result.statusCode || 200);
        
        if (result.headers) {
            Object.entries(result.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }

        if (result.isBase64Encoded) {
            res.send(Buffer.from(result.body, 'base64'));
        } else {
            try {
                // Try to parse as JSON first
                const parsedBody = JSON.parse(result.body);
                res.json(parsedBody);
            } catch {
                // If not JSON, send as text
                res.send(result.body);
            }
        }
    } catch (error) {
        console.error('Error in generateReport:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
        });
    }
});

// Health check endpoint for Docker
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'production'
    });
});

// Catch-all handler: send back index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Integralis Assessment Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`💻 Health check: http://0.0.0.0:${PORT}/health`);
    
    if (process.env.SENDGRID_API_KEY) {
        console.log('✅ SendGrid configured');
    } else {
        console.warn('⚠️  SENDGRID_API_KEY not configured - emails will fail');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});