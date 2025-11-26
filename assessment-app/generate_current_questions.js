const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generateQuestionsPDF() {
    try {
        // Load configuration files
        const questionsPath = path.join(__dirname, 'public/config/questions.json');
        const pillarsPath = path.join(__dirname, 'public/config/pillars.json');
        const levelDescriptorsPath = path.join(__dirname, 'public/config/level-descriptors.json');

        console.log('📖 Loading configuration files...');
        const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        const pillars = JSON.parse(fs.readFileSync(pillarsPath, 'utf8'));
        const levelDescriptors = JSON.parse(fs.readFileSync(levelDescriptorsPath, 'utf8'));

        // Generate HTML content
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>IT & Cyber Capability Assessment - Current Questions</title>
    <style>
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            margin: 25px;
            font-size: 14px;
            color: #333;
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px;
            border-bottom: 3px solid #2c5aa0;
            padding-bottom: 25px;
        }
        .header h1 { 
            color: #2c5aa0; 
            margin-bottom: 15px; 
            font-size: 28px;
        }
        .header h2 { 
            color: #555; 
            font-size: 18px; 
            margin-bottom: 10px;
        }
        .overview-box {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            padding: 25px;
            margin: 30px 0;
            border-radius: 8px;
            font-size: 14px;
        }
        .overview-box h3 {
            color: #2c5aa0;
            margin-top: 0;
            font-size: 18px;
        }
        .overview-box p {
            margin: 12px 0;
            line-height: 1.6;
        }
        .pillar-section { 
            margin-bottom: 45px; 
            page-break-inside: avoid;
        }
        .pillar-title { 
            background: #2c5aa0; 
            color: white;
            padding: 18px; 
            font-size: 18px; 
            font-weight: bold;
            margin-bottom: 30px;
            border-radius: 6px;
            text-align: center;
        }
        .question { 
            margin-bottom: 35px; 
            border: 2px solid #e9ecef; 
            padding: 25px;
            page-break-inside: avoid;
            border-radius: 8px;
            background: #fefefe;
        }
        .question-header { 
            font-weight: bold; 
            margin-bottom: 15px;
            color: #2c5aa0;
            font-size: 16px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 10px;
        }
        .question-prompt { 
            margin-bottom: 20px;
            font-style: italic;
            color: #555;
            font-size: 15px;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #2c5aa0;
        }
        .answer-options { 
            margin-left: 0px;
            margin-top: 20px;
        }
        .answer-options-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
            font-size: 15px;
        }
        .option { 
            margin-bottom: 12px;
            padding: 12px;
            background: #fdfdfd;
            border: 1px solid #e9ecef;
            border-radius: 5px;
        }
        .option-label { 
            font-weight: bold;
            color: #2c5aa0;
            font-size: 14px;
            display: block;
            margin-bottom: 5px;
        }
        .option-description { 
            color: #666;
            font-size: 13px;
            line-height: 1.5;
            margin-left: 0px;
        }
        @media print {
            body { margin: 20px; }
            .pillar-section { page-break-before: always; }
            .question { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>IT & Cyber Capability Assessment</h1>
        <h2>Complete Questions & Answer Options</h2>
        <p><strong>Current Version - ${new Date().toLocaleDateString('en-AU')}</strong></p>
    </div>

    <div class="overview-box">
        <h3>Assessment Overview</h3>
        <p><strong>Purpose:</strong> This document contains all current assessment questions and response options for stakeholder review.</p>
        <p><strong>Structure:</strong> 4 strategic capability pillars with varying question counts = 35 total questions</p>
        <p><strong>Answer Scale:</strong> Each question uses a 6-point maturity scale from "Not in place" (lowest) to "Mature/Optimised" (highest).</p>
        <p><strong>Scoring:</strong> Responses convert to numerical scores: Not in place (0), Ad hoc (20), Partially implemented (40), Defined but inconsistently applied (60), Consistently applied (80), Mature/Optimised (100).</p>
    </div>
`;

        // Process each pillar in order
        const pillarOrder = ['FOUNDATION', 'ITSM', 'SECURITY', 'GOVERNANCE'];
        
        pillarOrder.forEach(pillarId => {
            const pillar = pillars[pillarId];
            if (!pillar) return;
            
            html += `
    <div class="pillar-section">
        <div class="pillar-title">
            ${pillar.name} — Questions ${pillar.question_ids[0]}–${pillar.question_ids[pillar.question_ids.length - 1]} (${pillar.question_ids.length} questions)
        </div>
    `;
            
            // Get questions for this pillar in order
            pillar.question_ids.forEach(questionId => {
                const question = questions[questionId];
                const levelDescriptor = levelDescriptors[questionId];
                
                if (question && levelDescriptor) {
                    html += `
            <div class="question">
                <div class="question-header">
                    Question ${question.id}: ${question.short_label}
                </div>
                <div class="question-prompt">
                    ${question.full_prompt}
                </div>
                <div class="answer-options">
                    <div class="answer-options-title">Answer Options:</div>
            `;
                    
                    // Add answer options
                    const levelNames = [
                        'Not in place',
                        'Ad hoc', 
                        'Partially implemented',
                        'Defined but inconsistently applied',
                        'Consistently applied',
                        'Mature / Optimised'
                    ];
                    
                    for (let level = 0; level <= 5; level++) {
                        html += `
                    <div class="option">
                        <div class="option-label">○ ${levelNames[level]}</div>
                        <div class="option-description">${levelDescriptor.levels[level]}</div>
                    </div>
                `;
                    }
                    
                    html += `
                </div>
            </div>
            `;
                }
            });
            
            html += `</div>`;
        });

        html += `
</body>
</html>
`;

        // Write HTML file
        const htmlPath = path.join(__dirname, 'current_questions.html');
        fs.writeFileSync(htmlPath, html);
        console.log('✅ HTML file generated');

        // Generate PDF
        console.log('🚀 Launching browser...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        console.log('📖 Loading HTML...');
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
        
        console.log('📄 Generating PDF...');
        await page.pdf({
            path: 'Current_Assessment_Questions_2024.pdf',
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '12mm',
                bottom: '15mm',
                left: '12mm'
            }
        });
        
        await browser.close();
        
        // Clean up HTML file
        fs.unlinkSync(htmlPath);
        
        console.log('✅ PDF generated successfully: Current_Assessment_Questions_2024.pdf');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generateQuestionsPDF();