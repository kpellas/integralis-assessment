// Test script for PDF generation
const fetch = require('node-fetch');

async function testPdfGeneration() {
    // Sample answers for all 35 questions
    const answers = {};
    for (let i = 1; i <= 35; i++) {
        answers[i] = Math.floor(Math.random() * 6) * 20; // Random scores: 0, 20, 40, 60, 80, or 100
    }

    const payload = {
        organisation: 'Test Organisation',
        contactName: 'Test User',
        contactEmail: 'test@example.com',
        answers: answers,
        submittedAt: new Date().toISOString(),
        downloadOnly: true
    };

    try {
        console.log('Testing PDF generation with payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch('http://localhost:3000/.netlify/functions/generateReport', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());

        if (response.ok) {
            // Check if response is base64 or binary
            const contentType = response.headers.get('content-type');
            console.log('Content-Type:', contentType);
            
            let buffer;
            if (contentType && contentType.includes('application/pdf')) {
                // It's a binary PDF
                buffer = await response.buffer();
            } else {
                // It might be base64 encoded
                const base64Data = await response.text();
                console.log('Response data length:', base64Data.length);
                console.log('First 100 chars:', base64Data.substring(0, 100));
                buffer = Buffer.from(base64Data, 'base64');
            }
            
            console.log('PDF generated successfully! Size:', buffer.length, 'bytes');
            
            // Save the PDF for inspection
            const fs = require('fs');
            fs.writeFileSync('test-output.pdf', buffer);
            console.log('PDF saved as test-output.pdf');
        } else {
            const error = await response.text();
            console.error('Error response:', error);
        }
    } catch (error) {
        console.error('Request failed:', error);
    }
}

testPdfGeneration();