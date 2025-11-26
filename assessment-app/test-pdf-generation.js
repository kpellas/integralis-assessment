// Test PDF generation locally
const fs = require('fs').promises;
const generateReport = require('./netlify/functions/generateReport.js');

async function testPDF() {
    const testData = {
        body: JSON.stringify({
            organisation: "Acme Professional Services",
            contactName: "Sarah Thompson",
            contactEmail: "sarah@acme.com.au",
            downloadOnly: true,
            answers: {
                // Sample answers - mix of good and poor scores to test all sections
                "itsm_1": 80, // Service desk
                "itsm_2": 70, // Incident management
                "itsm_3": 75, // Change management
                "itsm_4": 50, // Service catalog
                "itsm_5": 60, // Performance tracking
                "itsm_6": 65, // ITSM automation
                "itsm_7": 85, // Documentation
                "cyber_1": 20, // MFA
                "cyber_2": 15, // Endpoint protection
                "cyber_3": 30, // Patching
                "cyber_4": 25, // Access controls
                "cyber_5": 90, // Backups
                "cyber_6": 10, // Network security
                "cyber_7": 35, // Incident response
                "process_1": 75, // Process documentation
                "process_2": 80, // Training materials
                "process_3": 45, // Manual processes
                "process_4": 40, // System integration
                "process_5": 55, // Process optimization
                "process_6": 50, // Change management
                "process_7": 60, // Performance metrics
                "opsex_1": 85, // Monitoring
                "opsex_2": 80, // Standard procedures
                "opsex_3": 90, // Task automation
                "opsex_4": 65, // Intelligent automation
                "opsex_5": 70, // Event correlation
                "opsex_6": 75, // Coverage optimization
                "opsex_7": 85, // Skills development
                "tech_1": 55, // Identity management
                "tech_2": 40, // Device management
                "tech_3": 80, // Backup/DR
                "tech_4": 35, // Network segmentation
                "tech_5": 70, // Cloud readiness
                "tech_6": 45, // Infrastructure monitoring
                "tech_7": 50  // Technical documentation
            }
        }),
        httpMethod: 'POST'
    };

    console.log('Testing PDF generation...');
    
    try {
        // Set environment variables for local testing
        process.env.NETLIFY_DEV = 'true';
        
        const result = await generateReport.handler(testData);
        console.log('Status:', result.statusCode);
        
        if (result.statusCode === 200) {
            const response = JSON.parse(result.body);
            console.log('Success!');
            console.log('Download URL:', response.downloadUrl);
            console.log('Filename:', response.filename);
        } else {
            console.error('Error:', result.body);
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testPDF();