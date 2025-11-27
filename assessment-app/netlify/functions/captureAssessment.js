const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const fsSync = require('fs');
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
        const { answers, tracking } = data;

        if (!answers) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Assessment answers are required' })
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

        // Calculate basic scores for the notification
        const scores = calculateScores(answers);
        
        // Load and format questions with answers
        const questionsWithAnswers = await formatQuestionsWithAnswers(answers);
        
        // Simple notification email to hardcoded addresses
        const recipients = ['kelly.pellas@integralis.com.au', 'assessment@integralis.com.au'];
        
        for (const recipient of recipients) {
            const msg = {
                to: recipient,
                from: {
                    email: process.env.FROM_EMAIL || 'assessment@integralis.com.au',
                    name: process.env.FROM_NAME || 'Integralis Assessment Team'
                },
                subject: `[${tracking?.sessionId || 'unknown'}] Assessment Complete (tracking) - ${scores.overallLevel} ${scores.overall}%`,
            html: `
                <h2>Assessment Completed</h2>
                <p><strong>Session ID:</strong> ${tracking?.sessionId || 'unknown'}</p>
                <p><strong>Overall Score:</strong> ${scores.overall}% (${scores.overallLevel})</p>
                
                <h3>Pillar Scores:</h3>
                <ul>
                    ${Object.values(scores.pillars).map(pillar => 
                        `<li><strong>${pillar.name}:</strong> ${pillar.score}% (${pillar.level})</li>`
                    ).join('')}
                </ul>
                
                ${tracking ? `
                <h3>Tracking Information:</h3>
                <ul>
                    <li><strong>Referrer:</strong> ${tracking.referrer}</li>
                    <li><strong>Landing Time:</strong> ${tracking.landingTime}</li>
                    <li><strong>Completion Time:</strong> ${tracking.completionTime}</li>
                    ${tracking.urlParams && Object.keys(tracking.urlParams).length > 0 ? 
                        `<li><strong>URL Parameters:</strong> ${JSON.stringify(tracking.urlParams, null, 2)}</li>` : 
                        '<li><strong>URL Parameters:</strong> None</li>'
                    }
                    <li><strong>User Agent:</strong> ${tracking.userAgent}</li>
                </ul>
                ` : ''}
                
                <p><em>User completed assessment but did not request detailed report.</em></p>
                
                <h3>Detailed Q&A Responses:</h3>
                <div style="font-family:monospace; font-size:12px;">
                    ${questionsWithAnswers}
                </div>
                `
            };

            await sgMail.send(msg);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Error capturing assessment:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to capture assessment',
                details: error.message 
            })
        };
    }
};

// Basic score calculation (simplified version)
function calculateScores(answers) {
    console.log('calculateScores received answers:', answers);
    
    const pillarQuestions = {
        'pillar1': [1, 2, 3, 4, 5, 6, 7, 8],
        'pillar2': [9, 10, 11, 12, 13, 14, 15, 16, 17],
        'pillar3': [18, 19, 20, 21, 22, 23, 24, 25, 26],
        'pillar4': [27, 28, 29, 30, 31, 32, 33, 34, 35]
    };

    const pillarNames = {
        'pillar1': 'Core IT Operations & Reliability',
        'pillar2': 'Strategic Service Management',
        'pillar3': 'Information Security & Governance',
        'pillar4': 'Risk, Compliance, & Assurance'
    };

    const pillars = {};
    let totalScore = 0;
    
    Object.keys(pillarQuestions).forEach(pillarKey => {
        const questions = pillarQuestions[pillarKey];
        console.log(`Processing ${pillarKey} with questions:`, questions);
        
        const pillarTotal = questions.reduce((sum, qNum) => {
            const answerKey = `q${qNum}`;
            const value = answers[answerKey] || 0;
            console.log(`  ${answerKey}: ${value} (type: ${typeof value})`);
            return sum + (parseInt(value) || 0);
        }, 0);
        
        console.log(`${pillarKey} total: ${pillarTotal}, questions.length: ${questions.length}`);
        const pillarScore = Math.round((pillarTotal / (questions.length * 100)) * 100);
        const pillarLevel = determineLevel(pillarScore);
        console.log(`${pillarKey} score: ${pillarScore}%`);
        
        pillars[pillarKey] = {
            name: pillarNames[pillarKey],
            score: pillarScore,
            level: pillarLevel
        };
        
        totalScore += pillarScore;
    });

    const overall = Math.round(totalScore / 4);
    const overallLevel = determineLevel(overall);

    return {
        overall,
        overallLevel,
        pillars
    };
}

function determineLevel(score) {
    if (score <= 30) return 'Foundational';
    if (score <= 50) return 'Developing';
    if (score <= 70) return 'Established';
    if (score <= 90) return 'Advanced';
    return 'Optimised';
}

// Load questions and format with answers
async function formatQuestionsWithAnswers(answers) {
    try {
        // Try function directory first (for Netlify), then public directory (for local)
        let questionsPath = path.join(__dirname, 'config', 'questions.json');
        let descriptorsPath = path.join(__dirname, 'config', 'level-descriptors.json');
        
        // Fallback to public directory if not found
        if (!fsSync.existsSync(questionsPath)) {
            questionsPath = path.join(process.cwd(), 'public', 'config', 'questions.json');
        }
        if (!fsSync.existsSync(descriptorsPath)) {
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