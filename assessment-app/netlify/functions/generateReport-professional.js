// Generate professional report HTML matching Integralis format
function generateReportHtml(data) {
    const { organisation, contactName, date, scores, overallLevel, insights, recommendedFrameworks, actionPlan, pillars, narratives, answers, questions } = data;
    
    // Helper to get pillar-specific insights
    const getPillarInsights = (pillarId) => {
        const pillarQuestions = Object.values(questions).filter(q => q.pillar_id === pillarId);
        const strengths = pillarQuestions
            .filter(q => answers[q.id] >= 80)
            .map(q => ({
                label: q.short_label,
                text: q.strength_text,
                score: answers[q.id]
            }));
        const gaps = pillarQuestions
            .filter(q => answers[q.id] <= 40)
            .map(q => ({
                label: q.short_label,
                text: q.gap_text,
                score: answers[q.id]
            }));
        const allScores = pillarQuestions.map(q => ({
            label: q.short_label,
            score: answers[q.id],
            question: q.full_prompt
        }));
        return { strengths, gaps, allScores };
    };
    
    return `
<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IT & Cyber Capability Assessment - ${organisation}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            background: white;
            font-size: 10pt;
        }
        
        .page {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 0 auto;
            background: white;
            page-break-after: always;
            position: relative;
        }
        
        @page {
            margin: 0;
            size: A4;
        }
        
        @media print {
            body { background: white; }
            .page {
                margin: 0;
                page-break-after: always;
            }
        }
        
        /* Header and Footer */
        .page-header {
            position: absolute;
            top: 15mm;
            left: 20mm;
            right: 20mm;
            padding-bottom: 8px;
            border-bottom: 2px solid #2B4F72;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo-small {
            font-weight: 700;
            color: #2B4F72;
            font-size: 11pt;
            letter-spacing: 1px;
        }
        
        .page-number {
            color: #666;
            font-size: 9pt;
        }
        
        .page-footer {
            position: absolute;
            bottom: 15mm;
            left: 20mm;
            right: 20mm;
            padding-top: 8px;
            border-top: 1px solid #ddd;
            color: #999;
            font-size: 8pt;
            text-align: center;
        }
        
        .content {
            margin-top: 35mm;
        }
        
        /* Cover Page */
        .cover-content {
            margin-top: 50mm;
        }
        
        .cover-title {
            font-size: 24pt;
            color: #2B4F72;
            font-weight: 700;
            margin-bottom: 10px;
            line-height: 1.2;
        }
        
        .cover-subtitle {
            font-size: 12pt;
            color: #666;
            margin-bottom: 40px;
        }
        
        .cover-details {
            padding: 20px;
            background: #f8f9fa;
            border-left: 4px solid #2B4F72;
        }
        
        .cover-details table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .cover-details td {
            padding: 8px 0;
            font-size: 10pt;
        }
        
        .cover-details td:first-child {
            font-weight: 600;
            color: #666;
            width: 140px;
        }
        
        .cover-details td:last-child {
            color: #333;
        }
        
        .maturity-inline {
            display: inline-block;
            padding: 3px 10px;
            background: #e8f4f8;
            color: #2B4F72;
            border-radius: 3px;
            font-weight: 600;
            font-size: 9pt;
        }
        
        /* Typography */
        h1 {
            color: #2B4F72;
            font-size: 16pt;
            font-weight: 700;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #2B4F72;
        }
        
        h2 {
            color: #2B4F72;
            font-size: 13pt;
            font-weight: 700;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        
        h3 {
            color: #2B4F72;
            font-size: 11pt;
            font-weight: 600;
            margin-top: 16px;
            margin-bottom: 8px;
        }
        
        p {
            margin-bottom: 10px;
            text-align: justify;
        }
        
        /* Tables */
        table.score-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 9pt;
        }
        
        table.score-table th {
            background: #2B4F72;
            color: white;
            padding: 8px;
            text-align: left;
            font-weight: 600;
            font-size: 9pt;
        }
        
        table.score-table td {
            padding: 8px;
            border-bottom: 1px solid #e9ecef;
        }
        
        table.score-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .score-col {
            font-weight: 700;
            color: #2B4F72;
            width: 80px;
            text-align: center;
        }
        
        .maturity-col {
            width: 120px;
            text-align: center;
        }
        
        /* Lists */
        ul.strength-list,
        ul.gap-list,
        ul.action-list {
            list-style: none;
            padding-left: 20px;
            margin: 10px 0;
        }
        
        .strength-list li,
        .gap-list li,
        .action-list li {
            position: relative;
            margin-bottom: 6px;
            padding-left: 16px;
            font-size: 9pt;
            line-height: 1.4;
        }
        
        .strength-list li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #28a745;
            font-weight: bold;
        }
        
        .gap-list li:before {
            content: "⚠";
            position: absolute;
            left: 0;
            color: #dc3545;
        }
        
        .action-list li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #2B4F72;
        }
        
        /* Boxes */
        .info-box {
            background: #f8f9fa;
            padding: 12px;
            border-left: 3px solid #2B4F72;
            margin: 12px 0;
            font-size: 9pt;
        }
        
        .overview-box {
            margin-top: 40px;
            padding: 16px;
            background: #e8f4f8;
            border-radius: 4px;
        }
        
        .overview-box h3 {
            margin-top: 0;
            margin-bottom: 12px;
        }
        
        .overview-box p {
            margin-bottom: 8px;
            text-align: left;
        }
        
        .overview-box p:last-child {
            margin-bottom: 0;
        }
        
        /* Pillar Sections */
        .pillar-section {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #2B4F72;
            page-break-inside: avoid;
        }
        
        .pillar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .pillar-name {
            font-size: 12pt;
            font-weight: 600;
            color: #2B4F72;
        }
        
        .pillar-score {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .pillar-percentage {
            font-size: 16pt;
            font-weight: 700;
            color: #2B4F72;
        }
        
        .pillar-level {
            padding: 3px 8px;
            background: #e8f4f8;
            color: #2B4F72;
            border-radius: 3px;
            font-size: 9pt;
            font-weight: 600;
        }
        
        .pillar-narrative {
            font-size: 9pt;
            color: #555;
            font-style: italic;
            margin-bottom: 12px;
            padding: 8px;
            background: white;
            border-radius: 3px;
        }
        
        .pillar-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 10px;
        }
        
        .pillar-column h4 {
            font-size: 10pt;
            color: #666;
            margin-bottom: 6px;
            font-weight: 600;
        }
        
        .pillar-column ul {
            margin: 0;
        }
        
        /* Two-column layout */
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 15px 0;
        }
        
        /* Framework section */
        .framework-box {
            background: #f8f9fa;
            padding: 12px;
            margin-bottom: 12px;
            border-left: 3px solid #2B4F72;
        }
        
        .framework-header {
            font-weight: 600;
            color: #2B4F72;
            margin-bottom: 6px;
        }
        
        .framework-description {
            font-size: 9pt;
            color: #555;
        }
    </style>
</head>
<body>

    <!-- PAGE 1: COVER PAGE -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
        </div>
        
        <div class="cover-content">
            <h1 class="cover-title">IT & Cyber Capability<br>Assessment Report</h1>
            <p class="cover-subtitle">Maturity Benchmarking Across Five Capability Pillars</p>
            
            <div class="cover-details">
                <table>
                    <tr>
                        <td>Organisation:</td>
                        <td><strong>${organisation}</strong></td>
                    </tr>
                    <tr>
                        <td>Assessment Date:</td>
                        <td>${date}</td>
                    </tr>
                    <tr>
                        <td>Prepared For:</td>
                        <td>${contactName}</td>
                    </tr>
                    <tr>
                        <td>Overall Maturity:</td>
                        <td><strong>${scores.overall}%</strong> <span class="maturity-inline">${overallLevel.label}</span></td>
                    </tr>
                </table>
            </div>
            
            <div class="overview-box">
                <h3>Assessment Overview</h3>
                <p>This assessment evaluates organisational maturity across five critical capability areas: ITSM & Service Management, Cyber Security Readiness (Essential 8/ISO/SMB1001), Business Process & Automation, Operational Excellence & Intelligent Automation, and Technical Capability Foundations.</p>
                <p>The report identifies strengths, gaps, and priority improvement actions based on responses to 35 validated maturity questions.</p>
            </div>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

    <!-- PAGE 2: EXECUTIVE SUMMARY -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 2</div>
        </div>
        
        <div class="content">
            <h1>Executive Summary</h1>
            
            <p>${overallLevel.narrative}</p>
            
            <h2>Maturity Scores by Capability Pillar</h2>
            <table class="score-table">
                <thead>
                    <tr>
                        <th>Capability Pillar</th>
                        <th>Score</th>
                        <th>Maturity Level</th>
                    </tr>
                </thead>
                <tbody>
                    ${scores.pillars.map(pillar => `
                    <tr>
                        <td>${pillar.name}</td>
                        <td class="score-col">${pillar.score}%</td>
                        <td class="maturity-col"><span class="maturity-inline">${pillar.level}</span></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h2>Key Strengths</h2>
            <ul class="strength-list">
                ${insights.strengths.slice(0, 5).map(s => `
                <li><strong>${s.label}:</strong> ${s.text}</li>
                `).join('')}
            </ul>
            
            <h2>Priority Improvement Areas</h2>
            <ul class="gap-list">
                ${insights.gaps.slice(0, 5).map(g => `
                <li><strong>${g.label}:</strong> ${g.text}</li>
                `).join('')}
            </ul>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

    <!-- PAGE 3+: DETAILED PILLAR ANALYSIS -->
    ${scores.pillars.map((pillar, index) => {
        const pillarInsights = getPillarInsights(pillar.id);
        return `
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page ${3 + index}</div>
        </div>
        
        <div class="content">
            <h1>${pillar.name}</h1>
            
            <div class="pillar-section">
                <div class="pillar-header">
                    <div class="pillar-name">Current Maturity</div>
                    <div class="pillar-score">
                        <span class="pillar-percentage">${pillar.score}%</span>
                        <span class="pillar-level">${pillar.level}</span>
                    </div>
                </div>
                
                <div class="pillar-narrative">
                    ${pillar.narrative || narratives[pillar.level]?.description || ''}
                </div>
                
                <h3>Assessment Results</h3>
                <table class="score-table">
                    <thead>
                        <tr>
                            <th>Capability Area</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pillarInsights.allScores.map(item => `
                        <tr>
                            <td>${item.label}</td>
                            <td class="score-col">${item.score}%</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                ${pillarInsights.strengths.length > 0 ? `
                <h3>Strengths</h3>
                <ul class="strength-list">
                    ${pillarInsights.strengths.map(s => `
                    <li><strong>${s.label}:</strong> ${s.text}</li>
                    `).join('')}
                </ul>
                ` : ''}
                
                ${pillarInsights.gaps.length > 0 ? `
                <h3>Improvement Areas</h3>
                <ul class="gap-list">
                    ${pillarInsights.gaps.map(g => `
                    <li><strong>${g.label}:</strong> ${g.text}</li>
                    `).join('')}
                </ul>
                ` : ''}
            </div>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>
        `;
    }).join('')}

    <!-- FRAMEWORK RECOMMENDATIONS PAGE -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page ${3 + scores.pillars.length + 1}</div>
        </div>
        
        <div class="content">
            <h1>Framework Alignment & Recommendations</h1>
            
            <p>Based on your maturity assessment, the following frameworks and standards are recommended to guide your improvement journey:</p>
            
            ${recommendedFrameworks.map(framework => `
            <div class="framework-box">
                <div class="framework-header">${framework.name} (${framework.tier})</div>
                <div class="framework-description">${framework.description}</div>
                ${framework.specific_actions ? `
                <ul class="action-list">
                    ${framework.specific_actions.slice(0, 3).map(action => `
                    <li>${action}</li>
                    `).join('')}
                </ul>
                ` : ''}
            </div>
            `).join('')}
            
            <h2>Next Steps</h2>
            <ol style="padding-left: 20px; font-size: 9pt;">
                <li style="margin-bottom: 8px;">Review detailed findings with your leadership team</li>
                <li style="margin-bottom: 8px;">Prioritise improvement initiatives based on business impact and risk</li>
                <li style="margin-bottom: 8px;">Develop a roadmap aligned with recommended frameworks</li>
                <li style="margin-bottom: 8px;">Establish metrics and regular assessment cycles to track progress</li>
                <li style="margin-bottom: 8px;">Consider engaging specialist support for critical capability gaps</li>
            </ol>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

</body>
</html>
    `;
}

module.exports = { generateReportHtml };