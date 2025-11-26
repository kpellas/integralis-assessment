// Test email template generation without sending
const fs = require('fs').promises;
const path = require('path');

// Mock SendGrid - just log what would be sent
const mockSgMail = {
    setApiKey: (key) => console.log('📧 SendGrid API key set'),
    send: (msg) => {
        console.log('📨 EMAIL WOULD BE SENT:');
        console.log('To:', msg.to);
        console.log('Subject:', msg.subject);
        console.log('HTML Length:', msg.html.length, 'characters');
        console.log('Attachments:', msg.attachments?.length || 0);
        if (msg.attachments?.length > 0) {
            console.log('PDF Size:', Math.round(msg.attachments[0].content.length / 1024), 'KB (base64)');
        }
        
        // Save HTML to file for inspection
        fs.writeFile('test-email.html', msg.html)
            .then(() => console.log('✅ Email HTML saved to test-email.html'))
            .catch(err => console.error('Error saving email HTML:', err));
        
        return Promise.resolve();
    }
};

// Test data
const testAnswers = {
    "Q1": 3, "Q2": 2, "Q3": 1, "Q4": 4, "Q5": 2,
    "Q6": 3, "Q7": 1, "Q8": 2, "Q9": 3, "Q10": 4,
    "Q11": 2, "Q12": 3, "Q13": 1, "Q14": 4, "Q15": 2,
    "Q16": 3, "Q17": 1, "Q18": 2, "Q19": 3, "Q20": 4,
    "Q21": 2, "Q22": 3, "Q23": 1, "Q24": 4, "Q25": 2,
    "Q26": 3, "Q27": 1, "Q28": 2, "Q29": 3, "Q30": 4,
    "Q31": 2, "Q32": 3, "Q33": 1, "Q34": 4, "Q35": 2
};

async function testEmailTemplate() {
    console.log('🧪 Testing Email Template Generation...\n');
    
    try {
        // Mock environment
        process.env.SENDGRID_API_KEY = 'test_key';
        process.env.FROM_EMAIL = 'test@integralis.com.au';
        process.env.FROM_NAME = 'Test Team';
        
        // Create test request
        const testRequest = {
            body: JSON.stringify({
                organisation: 'Test Company Pty Ltd',
                contactName: 'John Smith',
                contactEmail: 'john.smith@testcompany.com.au',
                answers: testAnswers,
                downloadOnly: false
            })
        };
        
        // Temporarily replace sgMail in the function
        const originalRequire = require;
        require.cache[require.resolve('@sendgrid/mail')] = {
            exports: mockSgMail
        };
        
        // Import and test the function
        const { handler } = require('./netlify/functions/generateReport.js');
        const result = await handler(testRequest);
        
        console.log('\n📋 RESULT:');
        console.log('Status Code:', result.statusCode);
        console.log('Response:', JSON.parse(result.body));
        
        console.log('\n✅ Email template test completed successfully!');
        console.log('Check test-email.html to review the email content.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

testEmailTemplate();