const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);
        const { name, email, organisation, phone, preferredTime, notes, sessionId, scores, tracking, answers } = data;

        if (!name || !email || !organisation || !phone) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Set up SendGrid
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'SendGrid API key not configured' })
            };
        }

        sgMail.setApiKey(apiKey);

        // Format questions with answers if available
        const questionsWithAnswers = answers ? await formatQuestionsWithAnswers(answers) : 'No detailed answers available';

        // Send callback request notification to both hardcoded addresses
        const recipients = ['kelly.pellas@integralis.com.au', 'assessment@integralis.com.au'];
        
        for (const recipient of recipients) {
            const msg = {
                to: recipient,
                from: {
                    email: process.env.FROM_EMAIL || 'assessment@integralis.com.au',
                    name: process.env.FROM_NAME || 'Integralis Assessment Team'
                },
                subject: `[${sessionId}] Callback Request - ${name} (${organisation})`,
                html: `
                <h2>Callback Request Received</h2>
                <p><strong>Session ID:</strong> ${sessionId}</p>
                
                <h3>Contact Details:</h3>
                <ul>
                    <li><strong>Name:</strong> ${name}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Organisation:</strong> ${organisation}</li>
                    <li><strong>Phone:</strong> ${phone}</li>
                    <li><strong>Preferred Contact Time:</strong> ${preferredTime}</li>
                    ${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ''}
                </ul>
                
                ${scores ? `
                <h3>Assessment Summary:</h3>
                <p><strong>Overall Score:</strong> ${scores.overall}% (${scores.overallLevel})</p>
                <ul>
                    ${Object.values(scores.pillars).map(pillar => 
                        `<li><strong>${pillar.name}:</strong> ${pillar.score}% (${pillar.level})</li>`
                    ).join('')}
                </ul>
                ` : ''}
                
                ${tracking ? `
                <h3>Source Information:</h3>
                <ul>
                    <li><strong>Referrer:</strong> ${tracking.referrer}</li>
                    <li><strong>Landing Time:</strong> ${new Date(tracking.landingTime).toLocaleString()}</li>
                    <li><strong>Request Time:</strong> ${new Date(tracking.requestTime).toLocaleString()}</li>
                    ${tracking.urlParams && Object.keys(tracking.urlParams).length > 0 ? 
                        `<li><strong>Campaign Data:</strong><br>${Object.entries(tracking.urlParams).map(([key, value]) => `&nbsp;&nbsp;${key}: ${value}`).join('<br>')}</li>` : 
                        ''
                    }
                </ul>
                ` : ''}
                
                <h3>Detailed Q&A Responses:</h3>
                <div style="font-family:monospace; font-size:12px; max-height:400px; overflow-y:auto; border:1px solid #ddd; padding:10px; background:#f9f9f9;">
                    ${questionsWithAnswers}
                </div>
                
                <p><em>Please contact ${name} at ${phone} during their preferred time: ${preferredTime}.</em></p>
                `
            };

            await sgMail.send(msg);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Error processing callback request:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to process callback request',
                details: error.message 
            })
        };
    }
};

// Load questions and format with answers
async function formatQuestionsWithAnswers(answers) {
    try {
        // Try function directory first (for Netlify), then public directory (for local)
        let questionsPath = path.join(__dirname, 'config', 'questions.json');
        let descriptorsPath = path.join(__dirname, 'config', 'level-descriptors.json');
        
        // Fallback to public directory if not found
        if (!fs.existsSync(questionsPath)) {
            questionsPath = path.join(process.cwd(), 'public', 'config', 'questions.json');
        }
        if (!fs.existsSync(descriptorsPath)) {
            descriptorsPath = path.join(process.cwd(), 'public', 'config', 'level-descriptors.json');
        }
        
        const questionsData = await fs.readFile(questionsPath, 'utf8');
        const descriptorsData = await fs.readFile(descriptorsPath, 'utf8');
        
        const questions = JSON.parse(questionsData);
        const descriptors = JSON.parse(descriptorsData);
        
        let formatted = '';
        for (let i = 1; i <= 35; i++) {
            const answerKey = `q${i}`;
            const answerValue = answers[answerKey] || 0;
            const question = questions[i.toString()];
            const descriptor = descriptors[i.toString()];
            
            if (question) {
                const levelKey = getLevelKey(answerValue);
                const fullAnswerText = descriptor && descriptor.levels && descriptor.levels[levelKey] 
                    ? descriptor.levels[levelKey] 
                    : getSelectedOption(answerValue);
                
                formatted += `<strong>Q${i}: ${question.short_label}</strong><br>`;
                formatted += `${question.full_prompt}<br>`;
                formatted += `<span style="color: #007bff;">→ Selected: ${fullAnswerText}</span><br><br>`;
            }
        }
        
        return formatted;
    } catch (error) {
        console.error('Error loading questions:', error);
        return `<p>Unable to load question details. Raw answers: ${JSON.stringify(answers, null, 2)}</p>`;
    }
}

// Convert answer value to level key for descriptors
function getLevelKey(value) {
    if (value === 0) return '0';
    if (value <= 20) return '1';
    if (value <= 40) return '2';
    if (value <= 60) return '3';
    if (value <= 80) return '4';
    return '5';
}

// Convert slider value to actual radio button option selected
function getSelectedOption(value) {
    if (value === 0) return 'Not in place';
    if (value <= 20) return 'Ad hoc';
    if (value <= 40) return 'Partially implemented';
    if (value <= 60) return 'Defined but inconsistently applied';
    if (value <= 80) return 'Consistently applied';
    return 'Mature / Optimised';
}