const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get the file ID from query parameters
        const fileId = event.queryStringParameters?.file;
        
        if (!fileId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'File ID is required' })
            };
        }

        // Validate file ID (should only contain alphanumeric characters)
        if (!/^[a-zA-Z0-9]+$/.test(fileId)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Invalid file ID' })
            };
        }

        // Construct the file path
        const tempPath = path.join(process.cwd(), '.temp', `assessment-${fileId}.pdf`);
        
        // Check if file exists and read it
        let pdfBuffer;
        try {
            pdfBuffer = await fs.readFile(tempPath);
        } catch (err) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'File not found or expired' })
            };
        }

        // Clean up the temporary file after reading
        try {
            await fs.unlink(tempPath);
        } catch (err) {
            console.warn('Failed to clean up temporary file:', err.message);
        }

        // Return the PDF file
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="IT-Capability-Assessment-${new Date().toISOString().split('T')[0]}.pdf"`,
                'Access-Control-Allow-Origin': '*'
            },
            body: pdfBuffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('Error serving PDF:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Failed to serve PDF',
                details: error.message 
            })
        };
    }
};