/**
 * Generate HTML report matching the preferred format
 * Replace the generateReportHTML() function in generateReport.js with this
 */
function generateReportHTML(data) {
    // Helper to capitalize
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    
    // Helper to escape HTML
    const escapeHtml = (text) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    // Get top 2 lowest scoring pillars for priority
    const sortedPillars = Object.entries(data.pillars)
        .sort((a, b) => a[1].score - b[1].score);
    const priorityPillars = sortedPillars.slice(0, 2);
    const secondaryPillars = sortedPillars.slice(2);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IT & Cyber Capability Assessment - ${escapeHtml(data.userCompany)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            background: #f5f5f5;
            font-size: 10pt;
        }
        
        .page {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 20px auto;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            page-break-after: always;
            position: relative;
        }
        
        @media print {
            body { background: white; }
            .page { margin: 0; box-shadow: none; page-break-after: always; }
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
            font-size: 12pt;
            color: #2B4F72;
            letter-spacing: 1px;
        }
        
        .page-number {
            font-size: 9pt;
            color: #666;
        }
        
        .page-footer {
            position: absolute;
            bottom: 15mm;
            left: 20mm;
            right: 20mm;
            padding-top: 8px;
            border-top: 1px solid #ddd;
            font-size: 8pt;
            color: #666;
            text-align: center;
        }
        
        .content {
            margin-top: 30mm;
            margin-bottom: 25mm;
        }
        
        /* Cover Page */
        .cover-content {
            margin-top: 60mm;
            text-align: center;
        }
        
        .cover-title {
            font-size: 22pt;
            color: #2B4F72;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1.3;
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
            text-align: left;
            max-width: 500px;
            margin: 0 auto;
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
        
        table.score-table tr.priority-row {
            background: #fff3cd;
        }
        
        .score-col {
            font-weight: 700;
            color: #2B4F72;
            text-align: center;
            width: 60px;
        }
        
        .bar-col {
            width: 140px;
        }
        
        .bar-container {
            background: #e9ecef;
            height: 20px;
            border-radius: 3px;
            overflow: hidden;
            position: relative;
        }
        
        .bar-fill {
            background: #2B4F72;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 8pt;
            font-weight: 600;
        }
        
        /* Lists */
        .strength-list, .gap-list, .action-list {
            list-style: none;
            padding-left: 0;
        }
        
        .strength-list li, .gap-list li, .action-list li {
            padding-left: 20px;
            margin-bottom: 6px;
            position: relative;
            font-size: 9pt;
            line-height: 1.4;
        }
        
        .strength-list li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #28a745;
            font-weight: 700;
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
            font-weight: 700;
        }
        
        /* Boxes */
        .info-box {
            background: #f8f9fa;
            padding: 12px;
            border-left: 3px solid #2B4F72;
            margin: 12px 0;
            font-size: 9pt;
        }
        
        .priority-box {
            background: #fff3cd;
            padding: 12px;
            border-left: 3px solid #ffc107;
            margin: 12px 0;
            font-size: 9pt;
        }
        
        /* Pillar Section - Compact */
        .pillar-compact {
            margin: 16px 0;
            padding: 12px;
            background: #f8f9fa;
            border-left: 4px solid #2B4F72;
            page-break-inside: avoid;
        }
        
        .pillar-header-compact {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .pillar-header-compact h3 {
            margin: 0;
            font-size: 11pt;
        }
        
        .pillar-score-inline {
            font-weight: 700;
            color: #2B4F72;
            font-size: 14pt;
            margin-right: 8px;
        }
        
        .pillar-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            font-size: 9pt;
        }
        
        .pillar-column h4 {
            font-size: 9pt;
            margin-bottom: 6px;
            color: #666;
            font-weight: 600;
        }
        
        .narrative-text {
            font-size: 9pt;
            margin-bottom: 10px;
            font-style: italic;
            color: #555;
        }
        
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
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
                        <td><strong>${escapeHtml(data.userCompany)}</strong></td>
                    </tr>
                    <tr>
                        <td>Assessment Date:</td>
                        <td>${data.date}</td>
                    </tr>
                    <tr>
                        <td>Prepared For:</td>
                        <td>${escapeHtml(data.userName)}</td>
                    </tr>
                    <tr>
                        <td>Overall Maturity:</td>
                        <td><strong>${data.overallScore}%</strong> <span class="maturity-inline">${capitalize(data.overallLevel)}</span></td>
                    </tr>
                </table>
            </div>
            
            <div style="margin-top: 40px; padding: 16px; background: #e8f4f8; border-radius: 4px; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto;">
                <h3 style="margin-top: 0; margin-bottom: 12px;">Assessment Overview</h3>
                <p style="margin-bottom: 8px; text-align: left;">This assessment evaluates organisational maturity across five critical capability areas: ITSM & Service Management, Cyber Security Readiness (Essential 8/ISO/SMB1001), Business Process & Automation, Operational Excellence & Intelligent Automation, and Technical Capability Foundations.</p>
                <p style="margin-bottom: 0; text-align: left;">The report identifies strengths, gaps, and priority improvement actions based on responses to 35 validated maturity questions.</p>
            </div>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${escapeHtml(data.userCompany)} | © ${new Date().getFullYear()} Integralis
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
            
            <div class="info-box">
                <p style="margin: 0;">${escapeHtml(data.overallNarrative)}</p>
            </div>
            
            <h2>Capability Pillar Scores</h2>
            
            <table class="score-table">
                <thead>
                    <tr>
                        <th>Capability Pillar</th>
                        <th style="text-align: center;">Score</th>
                        <th>Maturity Level</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedPillars.map(([pillarId, pillar]) => `
                    <tr${pillar.score < 40 ? ' class="priority-row"' : ''}>
                        <td>${escapeHtml(pillar.name)}</td>
                        <td class="score-col">${pillar.score}%</td>
                        <td>${capitalize(pillar.maturity_level)}</td>
                        <td class="bar-col">
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${pillar.score}%;">${pillar.score}%</div>
                            </div>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${priorityPillars.length > 0 && priorityPillars[0][1].score < 60 ? `
            <div class="priority-box">
                <h3 style="margin-top: 0;">Immediate Priorities</h3>
                <p style="margin-bottom: 0;"><strong>${escapeHtml(priorityPillars[0][1].name)}</strong>${priorityPillars.length > 1 ? ` and <strong>${escapeHtml(priorityPillars[1][1].name)}</strong>` : ''} ${priorityPillars.length > 1 ? 'are' : 'is'} the weakest ${priorityPillars.length > 1 ? 'pillars' : 'pillar'} and ${priorityPillars.length > 1 ? 'represent' : 'represents'} the greatest risk. ${priorityPillars.length > 1 ? 'These areas' : 'This area'} should be prioritised over the next 90 days to establish foundational controls and reduce organisational exposure.</p>
            </div>
            ` : ''}
            
            <h2>Top Recommended Actions</h2>
            <p style="font-size: 9pt; margin-bottom: 8px;">The following actions are derived from your lowest-scoring areas and represent the highest-value improvements:</p>
            
            <ul class="action-list">
                ${priorityPillars.slice(0, 2).map(([pillarId, pillar]) => 
                    pillar.gaps.slice(0, 2).map(gap => 
                        `<li>${escapeHtml(gap.text)}</li>`
                    ).join('')
                ).join('')}
                ${priorityPillars.slice(0, 1).map(([pillarId, pillar]) => 
                    pillar.actions.slice(0, 1).map(action => 
                        `<li>${escapeHtml(action)}</li>`
                    ).join('')
                ).join('')}
            </ul>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${escapeHtml(data.userCompany)} | © ${new Date().getFullYear()} Integralis
        </div>
    </div>

    <!-- PAGE 3: PRIORITY PILLARS -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 3</div>
        </div>
        
        <div class="content">
            <h1>Priority Pillar Analysis</h1>
            
            ${priorityPillars.map(([pillarId, pillar]) => `
            <div class="pillar-compact">
                <div class="pillar-header-compact">
                    <h3>${escapeHtml(pillar.name)}</h3>
                    <div>
                        <span class="pillar-score-inline">${pillar.score}%</span>
                        <span class="maturity-inline">${capitalize(pillar.maturity_level)}</span>
                    </div>
                </div>
                
                <p class="narrative-text">${escapeHtml(pillar.narrative)}</p>
                
                <div class="pillar-content">
                    <div class="pillar-column">
                        <h4>Strengths Identified</h4>
                        <ul class="strength-list">
                            ${pillar.strengths.length > 0 
                                ? pillar.strengths.map(s => `<li>${escapeHtml(s.text)}</li>`).join('')
                                : '<li style="font-style: italic; color: #999;">Limited strengths identified - focus on establishing foundational capabilities.</li>'}
                        </ul>
                    </div>
                    <div class="pillar-column">
                        <h4>Priority Improvements</h4>
                        <ul class="gap-list">
                            ${pillar.gaps.map(g => `<li>${escapeHtml(g.text)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            `).join('')}
            
            ${secondaryPillars.length > 0 ? `
            <h2>Secondary Priority Pillars</h2>
            
            ${secondaryPillars.map(([pillarId, pillar]) => `
            <div class="pillar-compact">
                <div class="pillar-header-compact">
                    <h3>${escapeHtml(pillar.name)}</h3>
                    <div>
                        <span class="pillar-score-inline">${pillar.score}%</span>
                        <span class="maturity-inline">${capitalize(pillar.maturity_level)}</span>
                    </div>
                </div>
                
                <p class="narrative-text">${escapeHtml(pillar.narrative)}</p>
                
                <div class="two-column">
                    <div>
                        <h4>Strengths</h4>
                        <ul class="strength-list">
                            ${pillar.strengths.length > 0 
                                ? pillar.strengths.slice(0, 2).map(s => `<li>${escapeHtml(s.text)}</li>`).join('')
                                : '<li style="font-style: italic; color: #999;">Limited strengths identified.</li>'}
                        </ul>
                    </div>
                    <div>
                        <h4>Priority Improvements</h4>
                        <ul class="gap-list">
                            ${pillar.gaps.slice(0, 2).map(g => `<li>${escapeHtml(g.text)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            `).join('')}
            ` : ''}
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${escapeHtml(data.userCompany)} | © ${new Date().getFullYear()} Integralis
        </div>
    </div>

    <!-- PAGE 4: RECOMMENDED ACTIONS -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 4</div>
        </div>
        
        <div class="content">
            <h1>Recommended Actions by Pillar</h1>
            
            ${Object.entries(data.pillars).map(([pillarId, pillar]) => `
            <h2>${escapeHtml(pillar.name)} <span style="color: #666; font-size: 10pt;">(${pillar.score}% - ${capitalize(pillar.maturity_level)})</span></h2>
            <ul class="action-list">
                ${pillar.actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}
            </ul>
            `).join('')}
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${escapeHtml(data.userCompany)} | © ${new Date().getFullYear()} Integralis
        </div>
    </div>

    ${data.frameworkPostures.length > 0 ? `
    <!-- PAGE 5: FRAMEWORK GUIDANCE -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 5</div>
        </div>
        
        <div class="content">
            <h1>Framework & Compliance Guidance</h1>
            
            <p style="font-size: 9pt;">Based on your assessment results, here are the compliance frameworks most relevant to your organisation's current maturity level:</p>
            
            ${data.frameworkPostures.map(fw => `
            <div class="info-box">
                <h3 style="margin-top: 0; margin-bottom: 8px;">${escapeHtml(fw.framework)}</h3>
                <p style="margin-bottom: 8px;"><strong>Status:</strong> <span class="maturity-inline">${capitalize(fw.status.replace('_', ' '))}</span></p>
                <p style="margin-bottom: 0;">${escapeHtml(fw.reason)}</p>
            </div>
            `).join('')}
            
            <h2>Next Steps</h2>
            <p style="font-size: 9pt;">Our team can help you develop a roadmap for achieving compliance with these frameworks. We'll work with you to:</p>
            <ul class="action-list">
                <li>Assess current gaps against framework requirements</li>
                <li>Develop a phased implementation plan</li>
                <li>Provide expert guidance and support throughout the journey</li>
                <li>Prepare for formal audits and certification</li>
            </ul>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${escapeHtml(data.userCompany)} | © ${new Date().getFullYear()} Integralis
        </div>
    </div>
    ` : ''}

    <!-- FINAL PAGE: CONTACT -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Final Page</div>
        </div>
        
        <div class="content">
            <h1>Next Steps & Support</h1>
            
            <h2>How Integralis Can Help</h2>
            <p>This assessment provides a foundation for improving your organisation's IT and operational capabilities. Our team specialises in helping organisations like yours move from assessment to action.</p>
            
            <div class="info-box" style="margin-top: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 12px;">Contact Us</h3>
                <p style="font-size: 10pt; line-height: 1.8; margin: 0;">
                    <strong>Email:</strong> info@integralis.com.au<br>
                    <strong>Web:</strong> www.integralis.com.au
                </p>
            </div>
            
            <p style="margin-top: 30px; font-size: 9pt; color: #666;">
                Thank you for taking the time to complete this assessment. We look forward to helping you achieve your capability and compliance goals.
            </p>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${escapeHtml(data.userCompany)} | © ${new Date().getFullYear()} Integralis
        </div>
    </div>

</body>
</html>
    `;
}

// Export for use
module.exports = { generateReportHTML };
