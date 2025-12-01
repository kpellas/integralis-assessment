// HTML escape function to prevent XSS
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// PDF generation disabled - no puppeteer needed
const isLocal = process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV === 'development';
const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const path = require('path');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        const data = JSON.parse(event.body);
        const { organisation, contactName, contactEmail, contactPhone, orgSize, industry, industryOther, answers, tracking, downloadOnly } = data;

        // Validate required fields
        if (!organisation || !contactName || !contactEmail || !answers) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        // Enhanced server-side validation
        const validationErrors = [];
        
        // Validate organisation name
        if (typeof organisation !== 'string' || organisation.trim().length < 2 || organisation.length > 200) {
            validationErrors.push('Organisation name must be 2-200 characters');
        }
        
        // Validate contact name
        if (typeof contactName !== 'string' || contactName.trim().length < 2 || contactName.length > 100) {
            validationErrors.push('Contact name must be 2-100 characters');
        }
        
        // Validate email format and domain
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof contactEmail !== 'string' || !emailRegex.test(contactEmail) || contactEmail.length > 254) {
            validationErrors.push('Valid email address required');
        }
        
        // Validate email domain (basic business email check)
        const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
        const domain = contactEmail.toLowerCase().split('@')[1];
        if (freeDomains.includes(domain)) {
            validationErrors.push('Business email address required');
        }
        
        if (validationErrors.length > 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ error: 'Validation failed', details: validationErrors })
            };
        }
        
        // Sanitize user inputs to prevent HTML/JS injection
        const safeOrganisation = escapeHtml(organisation.trim());
        const safeContactName = escapeHtml(contactName.trim());
        const safeContactEmail = escapeHtml(contactEmail.toLowerCase().trim());
        const safeContactPhone = contactPhone ? escapeHtml(contactPhone.trim()) : '';
        const safeOrgSize = orgSize ? escapeHtml(orgSize.trim()) : '';
        const safeIndustry = industry ? escapeHtml(industry.trim()) : '';
        const safeIndustryOther = industryOther ? escapeHtml(industryOther.trim()) : '';
        
        // Validate answers structure
        if (typeof answers !== 'object' || answers === null) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ error: 'Invalid answers payload' })
            };
        }

        // Load configuration files
        const [pillars, questions, narratives, pillarNarratives, frameworks] = await Promise.all([
            loadConfig('pillars.json'),
            loadConfig('questions.json'),
            loadConfig('overall_level_narratives.json'),
            loadConfig('pillar_narratives.json'),
            loadConfig('framework_guidance.json')
        ]);

        // Calculate scores
        const scores = calculateScores(answers, questions, pillars, pillarNarratives);
        
        // Determine maturity level
        const overallLevel = determineMaturityLevel(scores.overall, narratives);
        
        // Identify strengths and gaps
        const insights = identifyInsights(answers, questions, pillars);
        
        // Top 5 actions for email template
        const topActions = insights.gaps.slice(0, 5);
        
        // Determine framework recommendations
        const recommendedFrameworks = determineFrameworks(scores, frameworks);
        
        // Generate action plan (legacy)
        const actionPlan = generateActionPlan(scores, pillars);
        
        // Build proper roadmap structure
        const roadmapPhases = buildRoadmap(scores);
        
        // Build timeline-aware actions
        const timedActions = buildTimedActions(scores);
        
        // Generate HTML report
        const reportHtml = generateReportHtml({
            organisation: safeOrganisation,
            contactName: safeContactName,
            contactPhone: safeContactPhone,
            orgSize: safeOrgSize,
            industry: safeIndustry === 'Other' ? safeIndustryOther : safeIndustry,
            date: new Date().toLocaleDateString('en-AU', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            scores,
            overallLevel,
            insights,
            recommendedFrameworks,
            actionPlan,
            roadmapPhases,
            pillars,
            narratives,
            answers,  // Pass answers for detailed scoring
            questions, // Pass questions for pillar breakdowns
            timedActions // NEW: timeline-aware actions
        });

        // PDF generation disabled
        const pdfBuffer = null;

        // PDF generation disabled - skip local testing

        // PDF generation disabled - return error for download requests
        if (downloadOnly) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ 
                    error: 'PDF download is currently disabled',
                    message: 'Please use the email option to receive your assessment results'
                })
            };
        }

        // Otherwise, send email with content
        await sendEmail(safeContactEmail, safeContactName, safeOrganisation, pdfBuffer, {
            contactName: safeContactName,
            organisation: safeOrganisation,
            contactPhone: safeContactPhone,
            orgSize: safeOrgSize,
            industry: safeIndustry === 'Other' ? safeIndustryOther : safeIndustry,
            scores,
            overallLevel,
            insights,
            recommendedFrameworks,
            roadmapPhases,
            timedActions,
            topActions,
            tracking,
            answers
        });

        // Return success response with summary
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                overallScore: scores.overall,
                overallLevel: overallLevel,
                insights: insights,  // Include insights for testing
                scores: scores,      // Include full scores for testing
                pillarScores: scores.pillars.map(p => ({
                    name: p.name,
                    score: p.score,
                    level: p.level,
                    narrative: p.narrative
                }))
            })
        };

    } catch (error) {
        console.error('Error processing assessment:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', error.response?.body || error.response || 'No response details');
        
        // More detailed error info for debugging
        let errorMessage = error.message || 'Unknown error';
        let debugDetails = '';
        
        // Check for SendGrid errors
        if (error.response?.body?.errors) {
            debugDetails = error.response.body.errors.map(e => e.message).join(', ');
        } else if (error.code === 'ENOTFOUND') {
            debugDetails = 'Cannot reach SendGrid API';
        } else if (error.message?.includes('Unauthorized')) {
            debugDetails = 'SendGrid API key may be invalid';
        } else if (error.message?.includes('chrome') || error.message?.includes('puppeteer')) {
            debugDetails = 'PDF generation failed - Chrome/Puppeteer issue';
        }
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({ 
                error: 'Failed to process assessment',
                details: errorMessage,
                debugInfo: debugDetails || error.toString(),
                // Add timestamp for log correlation
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Load configuration file
async function loadConfig(filename) {
    // Try multiple possible locations for config files
    const possiblePaths = [
        // In Netlify functions, config is in same directory as function
        path.join(__dirname, 'config', filename),
        path.join(__dirname, '../config', filename),
        // Local development paths
        path.join(process.cwd(), 'public/config', filename),
        path.join(process.cwd(), 'assessment-app/public/config', filename),
        path.join(__dirname, '../../public/config', filename),
        path.join(__dirname, '../../../public/config', filename),
        // Add environment-specific path if CONFIG_PATH is set
        ...(process.env.CONFIG_PATH ? [path.join(process.env.CONFIG_PATH, filename)] : [])
    ];
    
    for (const filePath of possiblePaths) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            // Try next path
            continue;
        }
    }
    
    console.error('Tried config paths:', possiblePaths);
    throw new Error(`Could not find config file: ${filename}`);
}

// Effort mapping: low = 1, medium = 2, high = 3
function getEffortPoints(effort) {
    switch ((effort || 'medium').toLowerCase()) {
        case 'low':
            return 1;
        case 'high':
            return 3;
        case 'medium':
        default:
            return 2;
    }
}

// Normalise pillar.actions so every action is an object { text, effort }
function normalisePillarActions(rawActions = []) {
    return rawActions.map(action => {
        if (typeof action === 'string') {
            return { text: action, effort: 'medium' };
        }
        // assume { text, effort } or similar
        return {
            text: action.text || '',
            effort: action.effort || 'medium'
        };
    });
}

// Calculate all scores
function calculateScores(answers, questionsData, pillarsData, pillarNarratives) {
    // Calculate scores for each pillar
    const pillarScores = Object.values(pillarsData).map(pillar => {
        // Get questions for this pillar
        const pillarQuestions = pillar.question_ids.map(id => questionsData[id]);
        
        // Calculate weighted average score
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        pillarQuestions.forEach(question => {
            // Numeric safety: coerce to numbers and validate ranges
            const answerKey = `q${question.id}`;
            const rawAnswer = answers[answerKey];
            const answerValue = Math.max(0, Math.min(100, Number(rawAnswer) || 0)); // Clamp 0-100
            const weight = Number(question.weight) || 1; // Default weight to 1 if missing/invalid
            
            totalWeightedScore += answerValue * weight;
            totalWeight += weight;
        });
        
        const score = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
        const level = determineLevel(score);
        
        // Level is already in correct format (Foundational, Developing, etc.)
        const configLevel = level;
        
        const rawActions = pillar.level_action_templates[configLevel] || [];
        
        return {
            id: pillar.id,
            name: pillar.name,
            score: score,
            level: level,
            narrative: pillarNarratives[pillar.id]?.[level] || pillar.narratives?.[configLevel] || 'No narrative available',
            actions: normalisePillarActions(rawActions)   // now array of { text, effort }
        };
    });
    
    // Calculate overall score (average of all pillar scores)
    const overallScore = Math.round(
        pillarScores.reduce((sum, p) => sum + p.score, 0) / pillarScores.length
    );
    
    return {
        overall: overallScore,
        pillars: pillarScores
    };
}

// Maturity category mapping from 0-5 scale
function getMaturityCategory(score) {
    if (score <= 1.5) return "Foundational";
    if (score <= 2.5) return "Developing";
    if (score <= 3.5) return "Established";
    if (score <= 4.5) return "Advanced";
    return "Optimised";
}

// Roadmap phase mapping from maturity category
function getRoadmapPhase(category) {
    switch (category) {
        case "Foundational":
        case "Developing":
            return 1; // Foundations
        case "Established":
        case "Advanced":
            return 2; // Stabilisation
        case "Optimised":
            return 3; // Optimisation
        default:
            return 1;
    }
}

// Static phase metadata
const PHASE_META = {
    1: {
        id: 1,
        title: "Phase 1 – Foundations",
        description: "Address foundational capability gaps that affect stability, risk, and predictability."
    },
    2: {
        id: 2,
        title: "Phase 2 – Stabilisation", 
        description: "Tighten processes, improve visibility, and lift consistency across operations."
    },
    3: {
        id: 3,
        title: "Phase 3 – Optimisation",
        description: "Increase automation, streamline operations, and enhance efficiency and scalability."
    }
};

// Backward compatibility - convert 0-100% to maturity category
function determineLevel(score) {
    // Convert percentage to 0-5 scale for new system
    const normalizedScore = score / 20; // 0-100 -> 0-5
    return getMaturityCategory(normalizedScore);
}

// Determine maturity level from overall score
function determineMaturityLevel(score, narratives) {
    const level = determineLevel(score);
    // Level is already in correct format
    const narrativeKey = level;
    
    return {
        label: level,
        narrative: narratives[narrativeKey]
    };
}

// Identify top strengths and gaps
function identifyInsights(answers, questionsData, pillarsData) {
    const questionsList = Object.values(questionsData);

    // Build a scored list for reuse
    const scoredQuestions = questionsList.map(q => {
        const score = answers[`q${q.id}`] ?? 0;
        return {
            question: q,
            score,
            pillarId: q.pillar_id,
            pillarName: pillarsData[q.pillar_id]?.name || q.pillar_id
        };
    });
    
    // Calculate pillar scores to determine which strengths qualify
    const pillarScores = {};
    const pillarQuestionCounts = {};
    
    Object.values(pillarsData).forEach(pillar => {
        const pillarQuestions = scoredQuestions.filter(q => q.pillarId === pillar.id);
        const pillarTotal = pillarQuestions.reduce((sum, q) => sum + q.score, 0);
        const pillarAvg = pillarQuestions.length > 0 ? Math.round(pillarTotal / pillarQuestions.length) : 0;
        pillarScores[pillar.id] = pillarAvg;
        
        // Count how many questions in this pillar are ≥80%
        const highScoreCount = pillarQuestions.filter(q => q.score >= 80).length;
        pillarQuestionCounts[pillar.id] = highScoreCount;
    });

    // Updated banding as per requirements:
    // - strengths: ≥80
    // - gaps: ≤40  
    // - upliftAreas: 41-60
    // - optimisationAreas: 61-79
    
    const gapRaw = scoredQuestions.filter(item => item.score <= 40);
    const upliftRaw = scoredQuestions.filter(item => item.score > 40 && item.score <= 60);
    const optimisationRaw = scoredQuestions.filter(item => item.score > 60 && item.score < 80);
    
    // Create a set of issue themes to prevent contradictions
    const issueThemes = new Set();
    
    // Check for backup/DR related issues (questions 2 and 19)
    [...gapRaw, ...upliftRaw].forEach(item => {
        const label = item.question.short_label.toLowerCase();
        // Mark backup/DR as having issues if ANY related question is problematic
        if (label.includes('backup') || label.includes('dr') || label.includes('recovery')) {
            issueThemes.add('backup_dr');
        }
        // Add other thematic checks as needed
        if (label.includes('security') && label.includes('configuration')) {
            issueThemes.add('security_config');
        }
    });
    
    const strengthRaw = scoredQuestions.filter(item => {
        // Include any item ≥80% as a strength (simplified logic)
        if (item.score < 80) {
            return false;
        }
        
        // Prevent thematic contradictions
        const label = item.question.short_label.toLowerCase();
        if (issueThemes.has('backup_dr') && 
            (label.includes('backup') || label.includes('dr') || label.includes('recovery'))) {
            return false; // Don't include backup/DR as strength if there are backup/DR issues
        }
        if (issueThemes.has('security_config') && 
            label.includes('security') && label.includes('configuration')) {
            return false; // Don't include security config as strength if there are security config issues
        }
        
        return true;
    });

    // Helper to convert to the summary shape used in the report/email
    const toSummaryItems = (items, type) =>
        items
            .sort((a, b) => {
                // For strengths, higher score first; for gaps/uplift, lower score first
                return type === 'strength' ? b.score - a.score : a.score - b.score;
            })
            .map(item => ({
                pillar: item.pillarName,
                label: item.question.short_label,
                // NOTE: for now, we reuse gap_text for uplift/optimisation.
                // If we later add a mid_band_text to questions.json, plug it in here.
                text: type === 'strength'
                    ? item.question.strength_text
                    : item.question.gap_text,
                score: item.score
            }));

    const strengths = toSummaryItems(strengthRaw, 'strength').slice(0, 5);
    const gaps = toSummaryItems(gapRaw, 'gap').slice(0, 5);

    // Do NOT slice uplift/optimisation here – allow consumers to pick their own limits
    const upliftAreas = toSummaryItems(upliftRaw, 'gap');
    const optimisationAreas = toSummaryItems(optimisationRaw, 'gap');

    // Return all four arrays as required
    return {
        strengths,
        gaps,
        upliftAreas,
        optimisationAreas
    };
}

// Determine recommended frameworks based on pillar-specific scores
function determineFrameworks(scores, frameworksData) {
    const recommendations = [];
    
    // Get pillar-specific scores
    const securityPillar = scores.pillars.find(p => p.id === 'SECURITY');
    const governancePillar = scores.pillars.find(p => p.id === 'GOVERNANCE');
    const operationsPillar = scores.pillars.find(p => p.id === 'CORE_IT_OPERATIONS');
    
    const securityScore = securityPillar?.score || 0;
    const governanceScore = governancePillar?.score || 0;
    const operationsScore = operationsPillar?.score || 0;
    
    // Essential 8: Security-driven (boundaries: <30, 30-60 inclusive, >60)
    let essential8Tier;
    let essential8Rationale;
    if (securityScore < 30) {
        essential8Tier = frameworksData.essential8.low;
        essential8Rationale = `Basis: SECURITY ${securityScore}% → Essential 8 Level 1 focus`;
    } else if (securityScore <= 60) {
        essential8Tier = frameworksData.essential8.medium;
        essential8Rationale = `Basis: SECURITY ${securityScore}% → Essential 8 Level 1-2 transition`;
    } else {
        essential8Tier = frameworksData.essential8.high;
        essential8Rationale = `Basis: SECURITY ${securityScore}% → Essential 8 Level 2 progression`;
    }
    
    // SMB1001: Operations+Governance driven (boundaries: <40, 40-65 inclusive, >65)
    const opsGovAverage = Math.round((operationsScore + governanceScore) / 2);
    let smb1001Tier;
    let smb1001Rationale;
    if (opsGovAverage < 40) {
        smb1001Tier = frameworksData.smb1001.low;
        smb1001Rationale = `Basis: OPERATIONS+GOVERNANCE avg ${opsGovAverage}% → Build foundations first`;
    } else if (opsGovAverage <= 65) {
        smb1001Tier = frameworksData.smb1001.medium;
        smb1001Rationale = `Basis: OPERATIONS+GOVERNANCE avg ${opsGovAverage}% → Bronze tier feasible`;
    } else {
        smb1001Tier = frameworksData.smb1001.high;
        smb1001Rationale = `Basis: OPERATIONS+GOVERNANCE avg ${opsGovAverage}% → Silver/Gold achievable`;
    }
    
    // ISO 27001: Security+Governance driven with readiness gate (≥50, then 50-70 inclusive, >70)
    const secGovAverage = Math.round((securityScore + governanceScore) / 2);
    let iso27001Tier = null;
    let iso27001Rationale = '';
    
    if (secGovAverage >= 50) {
        if (secGovAverage <= 70) {
            iso27001Tier = frameworksData.iso27001.medium;
            iso27001Rationale = `Basis: SECURITY+GOVERNANCE avg ${secGovAverage}% → Medium-term goal`;
        } else {
            iso27001Tier = frameworksData.iso27001.high;
            iso27001Rationale = `Basis: SECURITY+GOVERNANCE avg ${secGovAverage}% → Near-term achievable`;
        }
    } else {
        iso27001Rationale = `Basis: SECURITY+GOVERNANCE avg ${secGovAverage}% → Not yet recommended`;
    }
    
    // Order by need/impact: Essential 8 first (security focus), then SMB1001, then ISO if eligible
    
    // Always include Essential 8 (security-focused)
    recommendations.push({
        framework: 'Essential 8',
        tier: essential8Tier.posture,
        guidance: essential8Tier.guidance,
        timeline: essential8Tier.timeline,
        next_steps: essential8Tier.next_steps,
        rationale: essential8Rationale
    });
    
    // Always include SMB1001 (practical business framework)
    recommendations.push({
        framework: 'SMB1001',
        tier: smb1001Tier.posture,
        guidance: smb1001Tier.guidance,
        timeline: smb1001Tier.timeline,
        next_steps: smb1001Tier.next_steps,
        rationale: smb1001Rationale
    });
    
    // Include ISO 27001 only if readiness gate is met
    if (iso27001Tier) {
        recommendations.push({
            framework: 'ISO 27001',
            tier: iso27001Tier.posture,
            guidance: iso27001Tier.guidance,
            timeline: iso27001Tier.timeline,
            next_steps: iso27001Tier.next_steps,
            rationale: iso27001Rationale
        });
    }
    
    return recommendations;
}

// Build roadmap structure based on pillar maturity
function buildRoadmap(scores) {
    const results = scores.pillars.map(pillar => {
        // Convert percentage score to 0-5 scale
        const normalizedScore = pillar.score / 20;
        const maturityCategory = getMaturityCategory(normalizedScore);
        const phaseId = getRoadmapPhase(maturityCategory);
        
        return {
            pillarKey: pillar.id,
            pillarName: pillar.name,
            averageScore: normalizedScore,
            percentageScore: pillar.score,
            maturityCategory,
            phaseId,
            narrative: pillar.narrative,
            actions: pillar.actions
        };
    });
    
    // Group by phase for the PDF
    const phases = {
        1: { ...PHASE_META[1], pillars: [] },
        2: { ...PHASE_META[2], pillars: [] },
        3: { ...PHASE_META[3], pillars: [] }
    };
    
    for (const result of results) {
        phases[result.phaseId].pillars.push(result);
    }
    
    return phases;
}

// Build immediate (0-30 day) and short-term (30-90 day) actions
function buildTimedActions(scores) {
    // Enhanced constants for intelligent action prioritization
    const MAX_30_DAY_EFFORT = 6;      // Base effort budget
    const MIN_30_DAY_COUNT = 3;       // Minimum viable action count
    const MAX_PER_PILLAR_30 = 2;      // Balanced coverage across pillars
    const GLOBAL_OVERFLOW_MAX = 1;    // Maximum effort overflow allowed

    // Sort pillars ascending by score (worst first)
    const sortedPillars = [...scores.pillars].sort((a, b) => a.score - b.score);
    
    // Find security pillar for override logic
    const securityPillar = scores.pillars.find(p => p.id === 'SECURITY');
    const securityScore = securityPillar?.score || 0;
    const governanceScore = scores.pillars.find(p => p.id === 'GOVERNANCE')?.score || 0;
    const operationsScore = scores.pillars.find(p => p.id === 'CORE_IT_OPERATIONS')?.score || 0;

    const immediate = [];
    const shortTerm = [];
    const ongoing = [];
    let effortUsed30 = 0;
    let overflowUsed = 0;
    let securityOverrideApplied = false;
    const rationale = [];
    
    // Generate unique submission ID for telemetry
    const submissionId = Math.random().toString(36).substring(2, 8);

    // Helper: Get actions from a pillar, sorted by effort (low → medium → high)
    function getSortedActions(pillar) {
        const actions = pillar.actions || [];
        return actions.sort((a, b) => getEffortPoints(a.effort) - getEffortPoints(b.effort));
    }

    // Helper: Add action if effort allows, with reason tracking
    function tryAddAction(action, pillar, reason, allowOverflow = false) {
        const cost = getEffortPoints(action.effort);
        const willUseOverflow = effortUsed30 + cost > MAX_30_DAY_EFFORT;
        const overflowNeeded = willUseOverflow ? (effortUsed30 + cost - MAX_30_DAY_EFFORT) : 0;
        
        // Check if we can accommodate this action
        if (willUseOverflow && (!allowOverflow || overflowUsed + overflowNeeded > GLOBAL_OVERFLOW_MAX)) {
            return false; // Would exceed overflow budget
        }
        
        if (effortUsed30 + cost <= MAX_30_DAY_EFFORT + GLOBAL_OVERFLOW_MAX) {
            immediate.push({
                pillarId: pillar.id,
                pillarName: pillar.name,
                score: pillar.score,
                level: pillar.level,
                text: action.text,
                effort: action.effort,
                reason: reason // Track why this action was selected
            });
            effortUsed30 += cost;
            if (willUseOverflow) {
                overflowUsed += overflowNeeded;
            }
            return true;
        }
        return false;
    }

    // STEP 1: Security override - if SECURITY ≤40, pre-include one security action
    if (securityScore <= 40 && securityPillar) {
        const securityActions = getSortedActions(securityPillar);
        if (securityActions.length > 0) {
            // Prefer low effort, fallback to medium if no low available
            const securityAction = securityActions[0]; // Already sorted low → medium → high
            if (tryAddAction(securityAction, securityPillar, 'security_override', true)) {
                securityOverrideApplied = true;
                rationale.push(`Security override: SECURITY ${securityScore}% → ${securityAction.text} (${securityAction.effort} effort)`);
                
                // Emit security override telemetry
                emitTelemetry('security_override_applied', {
                    submissionId,
                    securityScore,
                    item: { text: securityAction.text, effort: securityAction.effort }
                });
            }
        }
    }

    // STEP 2: Balanced fill - distribute actions across pillars
    const pillarCandidates = sortedPillars.map(pillar => ({
        pillar,
        actions: getSortedActions(pillar),
        added30Day: immediate.filter(item => item.pillarId === pillar.id).length
    }));

    // Balanced fill: up to MAX_PER_PILLAR_30 per pillar, low → medium → high preference
    let changed = true;
    while (changed && effortUsed30 < MAX_30_DAY_EFFORT) {
        changed = false;
        
        for (const candidate of pillarCandidates) {
            // Skip if this pillar has reached its quota
            if (candidate.added30Day >= MAX_PER_PILLAR_30) continue;
            
            // Find next available action for this pillar (already sorted by effort)
            const availableActions = candidate.actions.filter(action => 
                !immediate.some(item => 
                    item.pillarId === candidate.pillar.id && 
                    item.text === action.text
                )
            );
            
            if (availableActions.length > 0) {
                const nextAction = availableActions[0];
                if (tryAddAction(nextAction, candidate.pillar, 'balanced_fill', false)) {
                    candidate.added30Day++;
                    changed = true;
                }
            }
        }
    }

    // STEP 3: Minimum count enforcement - lift per-pillar cap for lowest-scoring pillar
    if (immediate.length < MIN_30_DAY_COUNT) {
        rationale.push(`Minimum count enforcement: ${immediate.length} < ${MIN_30_DAY_COUNT}, relaxing constraints`);
        
        // Only the single lowest-scoring pillar benefits from the relax
        const lowestScoringPillar = sortedPillars[0]; // Already sorted ascending
        const lowestCandidate = pillarCandidates.find(c => c.pillar.id === lowestScoringPillar.id);
        
        if (lowestCandidate) {
            // Find remaining actions for this pillar, sorted by effort
            const availableActions = lowestCandidate.actions.filter(action => 
                !immediate.some(item => 
                    item.pillarId === lowestCandidate.pillar.id && 
                    item.text === action.text
                )
            );
            
            // Try to add actions until minimum count reached or overflow exhausted
            for (const action of availableActions) {
                if (immediate.length >= MIN_30_DAY_COUNT) break;
                
                // Use remaining overflow budget for min-count relax
                if (tryAddAction(action, lowestCandidate.pillar, 'min_count_relax', true)) {
                    rationale.push(`Min-count relax: ${lowestCandidate.pillar.name} → ${action.text} (${action.effort})`);
                }
            }
        }
    }

    // Categorize remaining actions by pillar score
    sortedPillars.forEach(pillar => {
        const remainingActions = (pillar.actions || []).filter(action => 
            !immediate.some(item => 
                item.pillarId === pillar.id && 
                item.text === action.text
            )
        );
        
        remainingActions.forEach(action => {
            const actionItem = {
                pillarId: pillar.id,
                pillarName: pillar.name,
                score: pillar.score,
                level: pillar.level,
                text: action.text,
                effort: action.effort
            };
            
            if (pillar.score > 65) {
                ongoing.push(actionItem);  // High-performing pillars → ongoing optimization
            } else {
                shortTerm.push(actionItem);  // Everything else → 30-90 days
            }
        });
    });

    // Sort for consistent presentation
    const sortByScore = (a, b) => a.score - b.score;
    immediate.sort(sortByScore);
    shortTerm.sort(sortByScore);
    ongoing.sort(sortByScore);

    // Build rationale summary
    const pillarCounts = immediate.reduce((acc, item) => {
        acc[item.pillarName] = (acc[item.pillarName] || 0) + 1;
        return acc;
    }, {});
    
    const pillarSummary = Object.entries(pillarCounts)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ');
    
    if (!rationale.length) {
        rationale.push(`Balanced prioritization: ${pillarSummary}, ${effortUsed30}/${MAX_30_DAY_EFFORT} effort points`);
    }

    // Emit telemetry events
    emitTelemetry('action_plan_built', {
        submissionId,
        overall: scores.overall,
        securityScore,
        governanceScore, 
        operationsScore,
        constants: { MAX_30_DAY_EFFORT, MIN_30_DAY_COUNT, MAX_PER_PILLAR_30, GLOBAL_OVERFLOW_MAX },
        counts: { immediate: immediate.length, shortTerm: shortTerm.length, ongoing: ongoing.length },
        overflowUsed,
        securityOverrideApplied
    });
    
    emitTelemetry('immediate_list_finalized', {
        submissionId,
        items: immediate.map(item => ({
            pillarId: item.pillarId,
            pillarName: item.pillarName, 
            score: item.score,
            effort: item.effort,
            reason: item.reason
        })),
        totalEffort: effortUsed30
    });

    return {
        immediate,   // 0–30 days (intelligent prioritization with scarce-actions fallback)
        shortTerm,   // 30–90 days
        ongoing,     // >90 days / optimization
        rationale: rationale.join('; ')
    };
}

// Telemetry emission function
function emitTelemetry(eventName, payload) {
    const timestamp = new Date().toISOString();
    
    // Console logging for development
    if (process.env.NETLIFY_DEV === 'true') {
        console.log(`📊 Telemetry [${eventName}]:`, JSON.stringify(payload, null, 2));
        return;
    }
    
    // Teams webhook for production
    if (process.env.TEAMS_WEBHOOK_URL && eventName === 'action_plan_built') {
        const weakPillars = [];
        if (payload.securityScore <= 50) weakPillars.push(`SECURITY(${payload.securityScore})`);
        if (payload.governanceScore <= 50) weakPillars.push(`GOVERNANCE(${payload.governanceScore})`);
        if (payload.operationsScore <= 50) weakPillars.push(`OPERATIONS(${payload.operationsScore})`);
        
        const teamsPayload = {
            text: `Assessment action plan built
Submission: ${payload.submissionId}
Immediate: ${payload.counts.immediate} (effort ${payload.totalEffort || 0}, overflow ${payload.overflowUsed})
Security override: ${payload.securityOverrideApplied}
${weakPillars.length > 0 ? `Weak pillars: ${weakPillars.join(', ')}` : 'All pillars performing well'}`
        };
        
        // Send to Teams (non-blocking)
        fetch(process.env.TEAMS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamsPayload)
        }).catch(err => console.log('Teams webhook failed:', err.message));
    }
}

// Generate action plan from pillar scores (legacy function for compatibility)
function generateActionPlan(scores, pillarsData) {
    const actions = [];
    
    // Get top 3 actions from each pillar based on their level
    scores.pillars.forEach(pillar => {
        const pillarActions = pillar.actions.slice(0, 3).map(action => ({
            pillar: pillar.name,
            action: typeof action === 'string' ? action : action.text,
            priority: pillar.score < 40 ? 'High' : pillar.score < 60 ? 'Medium' : 'Low'
        }));
        actions.push(...pillarActions);
    });
    
    // Sort by priority and return top 10
    return actions
        .sort((a, b) => {
            const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 10);
}

// Generate PDF from HTML
// PDF generation disabled - function not used
/* async function generatePdf(html) {
    let browser = null;
    
    try {
        if (isLocal) {
            // Local development configuration
            if (puppeteer.launch) {
                // Using full puppeteer with bundled Chromium
                console.log('Using bundled puppeteer for PDF generation');
                browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            } else {
                // Fallback to puppeteer-core with chrome-aws-lambda
                console.log('Fallback to puppeteer-core for local dev');
                const executablePath = await chromium.executablePath;
                browser = await puppeteer.launch({
                    args: chromium.args,
                    defaultViewport: chromium.defaultViewport,
                    executablePath: executablePath || undefined,
                    headless: chromium.headless
                });
            }
        } else {
            // Production configuration (Netlify)
            const executablePath = await chromium.executablePath;
            
            if (!executablePath) {
                console.error('Chrome executable path not found - chrome-aws-lambda may not be properly configured');
            }
            
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: executablePath || undefined,
                headless: chromium.headless
            });
        }
        
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            },
            preferCSSPageSize: true
        });
        
        return pdf;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
} */

// Generate professional report HTML matching Integralis format exactly
function generateReportHtml(data) {
    const { organisation, contactName, contactPhone, orgSize, industry, date, scores, overallLevel, insights, recommendedFrameworks, actionPlan, roadmapPhases, pillars, narratives, answers, questions, timedActions } = data;
    
    // Helper to transform strength text into action-oriented optimisation text
    const transformToOptimisationTextHtml = (strengthText, label) => {
        // Common transformations for action-oriented language
        const transformations = {
            // Device management
            'managed via a central platform': 'Expand device management to cover 100% of endpoints and standardise baseline configurations',
            'centrally managed': 'Extend centralised management to all device types and automate compliance checking',
            
            // Recovery and backups
            'dependable and tested': 'Increase the frequency and scope of recovery testing to include complex, multi-system scenarios',
            'reliable and tested': 'Automate recovery testing and expand to cover edge cases and disaster scenarios',
            
            // Service desk / ITSM
            'well-documented and followed': 'Introduce XLAs linked to user satisfaction and business outcomes',
            'structured and reliable': 'Automate handoffs and approvals to further reduce handling time and manual rework',
            
            // MFA and identity
            'fully enforced': 'Extend conditional access policies and implement risk-based authentication',
            'centralised with strong': 'Integrate identity lifecycle events with downstream systems to eliminate manual access changes',
            
            // Compliance and baselines
            'well-defined and consistently': 'Automate compliance checks and integrate results into risk reporting dashboards',
            'clear governance': 'Introduce continuous control monitoring to reduce reliance on periodic manual reviews',
            
            // Patching
            'consistently performed': 'Automate patch deployment and reduce mean time to patch for critical vulnerabilities',
            'defined schedule': 'Implement zero-downtime patching strategies and automated rollback capabilities',
            
            // General patterns
            'in place': 'Enhance automation and expand coverage to eliminate remaining manual processes',
            'documented': 'Digitise documentation and implement automated validation of procedures',
            'consistent': 'Standardise across all business units and implement continuous improvement metrics',
            'reliable': 'Implement predictive analytics and proactive remediation capabilities',
            'established': 'Mature the process with automation and integrate with broader ecosystem'
        };
        
        // Check for specific patterns and return optimised text
        for (const [pattern, replacement] of Object.entries(transformations)) {
            if (strengthText.toLowerCase().includes(pattern.toLowerCase())) {
                return replacement;
            }
        }
        
        // Generic fallback transformations based on keywords
        if (strengthText.includes('enforced') || strengthText.includes('implemented')) {
            return `Expand and automate ${label.toLowerCase()} to achieve full coverage and reduce manual overhead`;
        }
        if (strengthText.includes('documented') || strengthText.includes('defined')) {
            return `Mature ${label.toLowerCase()} through automation and continuous improvement practices`;
        }
        if (strengthText.includes('process') || strengthText.includes('procedure')) {
            return `Optimise ${label.toLowerCase()} with automation, metrics, and predictive capabilities`;
        }
        
        // Ultimate fallback
        return `Further enhance ${label.toLowerCase()} through automation and process optimisation`;
    };
    
    // Derive top issues - smart selection logic
    const hasCriticalGaps = insights.gaps && insights.gaps.length > 0;
    let topIssues;
    
    if (hasCriticalGaps) {
        // If there are gaps (≤40%), show only those
        topIssues = insights.gaps.slice(0, 5);
    } else if (insights.upliftAreas && insights.upliftAreas.length > 0) {
        // If no gaps but upliftAreas (41-60) exist, show 3-5 of them
        // Sort by score (lowest first) for priority
        topIssues = insights.upliftAreas
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);
    } else {
        // Only show generic message if neither gaps nor upliftAreas exist
        topIssues = [];
    }
    
    // Helper to get pillar-specific insights
    const getPillarInsights = (pillarId) => {
        // Get the pillar average score
        const pillarQuestions = Object.values(questions).filter(q => q.pillar_id === pillarId);
        const pillarScores = pillarQuestions.map(q => answers[`q${q.id}`] ?? 0);
        const pillarAvg = pillarScores.length > 0 ? Math.round(pillarScores.reduce((a,b) => a+b, 0) / pillarScores.length) : 0;
        
        // Count how many questions in this pillar are ≥80%
        const highScoreCount = pillarScores.filter(s => s >= 80).length;

        const scored = pillarQuestions.map(q => {
            const score = answers[`q${q.id}`] ?? 0;
            return { question: q, score };
        });

        // Get all issues (gaps + uplift) to check for thematic conflicts
        const allIssues = scored.filter(item => item.score <= 60);
        const issueThemes = new Set();
        
        // Check for backup/DR related issues
        allIssues.forEach(item => {
            const label = item.question.short_label.toLowerCase();
            if (label.includes('backup') || label.includes('dr') || label.includes('recovery')) {
                issueThemes.add('backup_dr');
            }
            if (label.includes('security') && label.includes('configuration')) {
                issueThemes.add('security_config');
            }
        });

        // Strengths: ≥80 (simplified - no pillar-level filtering for per-pillar view)
        const strengths = scored
            .filter(item => {
                if (item.score < 80) {
                    return false;
                }
                
                // Prevent thematic contradictions
                const label = item.question.short_label.toLowerCase();
                if (issueThemes.has('backup_dr') && 
                    (label.includes('backup') || label.includes('dr') || label.includes('recovery'))) {
                    return false;
                }
                if (issueThemes.has('security_config') && 
                    label.includes('security') && label.includes('configuration')) {
                    return false;
                }
                
                return true;
            })
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.strength_text,
                score: item.score
            }));

        const gaps = scored
            .filter(item => item.score <= 40)
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.gap_text,
                score: item.score
            }));

        const upliftAreas = scored
            .filter(item => item.score > 40 && item.score <= 60)
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.gap_text, // reused for now
                score: item.score
            }));

        // Optimisation areas: 61-79 (updated range)
        const optimisationAreas = scored
            .filter(item => item.score > 60 && item.score < 80)
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                label: item.question.short_label,
                text: transformToOptimisationTextHtml(item.question.strength_text, item.question.short_label),
                score: item.score
            }));
        
        const allScores = pillarQuestions.map(q => ({
            label: q.short_label,
            score: answers[`q${q.id}`],
            question: q.full_prompt
        }));

        return {
            strengths,
            gaps,
            upliftAreas,
            optimisationAreas,
            allScores
        };
    };

    // Sort pillars by score to identify priorities - match assessment.html structure
    const sortedPillars = [...scores.pillars].sort((a, b) => a.score - b.score);
    const priorityPillars = sortedPillars.filter(p => p.score <= 40);  // Priority (worst 2 typically)
    const secondaryPillars = sortedPillars.filter(p => p.score > 40 && p.score <= 65); // Secondary/developing
    const strengthPillars = sortedPillars.filter(p => p.score > 65); // Strengths

    // Top 5 actions from gaps
    const topActions = insights.gaps.slice(0, 5);
    
    return `
<!DOCTYPE html>
<html lang="en">
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
            background: #f5f5f5;
            font-size: 10pt;
        }
        
        /* Page break utilities */
        .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        
        .avoid-break-heading {
            break-after: avoid;
            page-break-after: avoid;
        }
        
        /* Comprehensive no-split rules */
        .no-split,
        .pillar-section,
        .roadmap-phase,
        .roadmap-pillar,
        .framework-section,
        .final-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block;
        }
        
        h2, h3 {
            page-break-after: avoid;
            break-after: avoid;
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
            .page {
                margin: 0;
                box-shadow: none;
                page-break-after: always;
            }
            
            /* Disable grid/flex in print to prevent splitting */
            .pillar-content,
            .roadmap-content,
            .framework-content {
                display: block !important;
            }
            
            .pillar-column,
            .roadmap-column {
                margin-bottom: 8px;
                page-break-inside: avoid;
            }
        }
        
        /* Header and Footer - matching assessment.html exactly */
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
            font-size: 10pt;
            text-align: center;
        }
        
        .content {
            margin-top: 25mm;
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
        
        /* Typography - matching assessment.html */
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
        
        /* Tables - exact match to assessment.html */
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
            width: 180px;
        }
        
        .bar-container {
            width: 100%;
            height: 18px;
            background: #e9ecef;
            border-radius: 2px;
            overflow: hidden;
        }
        
        .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #2B4F72 0%, #4a7ba7 100%);
            display: flex;
            align-items: center;
            padding-left: 6px;
            color: white;
            font-weight: 600;
            font-size: 10pt;
        }
        
        /* Lists - matching assessment.html exactly */
        ul {
            margin: 10px 0;
            padding-left: 0;
            list-style: none;
        }
        
        ul li {
            margin-bottom: 4px;
            padding-left: 20px;
            position: relative;
            font-size: 9pt;
        }
        
        ul li:before {
            content: "▸";
            color: #2B4F72;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        .strength-list li:before {
            content: "✓";
            color: #28a745;
        }
        
        .gap-list li:before {
            content: "⚠";
            color: #dc3545;
        }
        
        .action-list li:before {
            content: "→";
            color: #2B4F72;
        }
        
        /* Boxes - matching assessment.html */
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
        
        /* Pillar Section - Compact - exact match to assessment.html */
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
        
        .pillar-column ul {
            margin: 0;
        }
        
        .narrative-text {
            font-size: 9pt;
            margin-bottom: 10px;
            font-style: italic;
            color: #555;
        }
        
        /* Two-column layout */
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        
        .full-width {
            grid-column: 1 / -1;
        }
        
        /* Better page break handling for roadmap */
        .roadmap-container {
            orphans: 2;
            widows: 2;
        }
        
        .roadmap-phase {
            page-break-inside: avoid;
            orphans: 3;
            widows: 3;
            margin-bottom: 20px;
        }
        
        .roadmap-pillar {
            page-break-inside: avoid;
            margin-bottom: 15px;
            clear: both;
            overflow: hidden;
        }
        
        .roadmap-pillar h4 {
            clear: both;
            overflow: hidden;
        }
        
        .roadmap-pillar p {
            clear: both;
            overflow: hidden;
        }
        
        .roadmap-pillar ul {
            clear: both;
            overflow: hidden;
        }
        
        .phase-break-before {
            page-break-before: auto;
        }
        
        /* Force page break for longer roadmaps */
        .roadmap-long-break {
            page-break-before: always;
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
            <p class="cover-subtitle">Maturity Benchmarking Across Four Strategic Capability Pillars</p>
            
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
            
            <div style="margin-top: 40px; padding: 16px; background: #e8f4f8; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 12px;">Assessment Overview</h3>
                <p style="margin-bottom: 8px; text-align: left;">This assessment evaluates organisational maturity across four strategic capability areas: Digital Foundation & Performance, Strategic Service Management (ITSM + ESM), Information Security & Governance, and Risk, Compliance, & Assurance.</p>
                <p style="margin-bottom: 0; text-align: left;">The report identifies strengths, gaps, and priority improvement actions based on responses to 35 validated maturity questions.</p>
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
            
            <p><strong>Overall Assessment: ${scores.overall}% (${overallLevel.label})</strong></p>
            <p style="font-style: italic; color: #555;">${overallLevel.narrative}</p>
            
            <h2>Capability Pillar Scores</h2>
            
            <table class="score-table">
                <thead>
                    <tr>
                        <th>Capability Pillar</th>
                        <th class="score-col">Score</th>
                        <th>Maturity</th>
                        <th class="bar-col">Performance</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedPillars.map(pillar => `
                    <tr${pillar.score <= 40 ? ' class="priority-row"' : ''}>
                        <td>${pillar.score <= 40 ? `<strong>${pillar.name}</strong>` : pillar.name}</td>
                        <td class="score-col"><strong>${pillar.score}%</strong></td>
                        <td><strong>${pillar.level}</strong></td>
                        <td class="bar-col">
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${pillar.score}%;">${pillar.score}%</div>
                            </div>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${priorityPillars.length > 0 ? `
            <div class="priority-box">
                <h3 style="margin-top: 0;">Immediate Priorities</h3>
                <p style="margin-bottom: 0;"><strong>${(() => {
                    const names = priorityPillars.map(p => p.name);
                    if (names.length === 1) return names[0];
                    if (names.length === 2) return names.join('</strong> and <strong>');
                    return names.slice(0, -1).join('</strong>, <strong>') + '</strong>, and <strong>' + names[names.length - 1];
                })()}</strong> ${priorityPillars.length === 1 ? 'is' : 'are'} the weakest ${priorityPillars.length === 1 ? 'pillar' : 'pillars'} and ${priorityPillars.length === 1 ? 'represents' : 'represent'} the greatest risk. ${priorityPillars.length === 1 ? 'This area' : 'These areas'} should be prioritised over the next 90 days to establish foundational controls and reduce organisational exposure.</p>
            </div>
            ` : ''}
            
            <h2>Top Priority Issues</h2>
            
            ${hasCriticalGaps ? `
            <p style="font-size: 9pt; margin-bottom: 8px;">
                These issues are drawn from the lowest-scoring questions across all pillars. 
                They represent the areas with the greatest operational risk, inefficiency, 
                or potential business impact based on your assessment responses.
            </p>
            ` : `
            <p style="font-size: 9pt; margin-bottom: 8px;">
                Your responses did not identify any severe gaps (≤40%). 
                The items below represent partially implemented or inconsistently applied practices 
                where standardising and embedding the approach will materially improve outcomes.
            </p>
            `}
            
            ${topIssues.length > 0 ? `
            <ul class="gap-list">
                ${topIssues.map(issue => `
                    <li>
                        ${issue.text}
                        <em>(${issue.pillar})</em>
                    </li>
                `).join('')}
            </ul>
            ` : `
            <p style="font-size: 9pt; color: #666; margin-top: 4px;">
                No specific question-level issues were identified. Your answers are highly uniform; 
                please review the pillar-level narratives and roadmap for your next steps.
            </p>
            `}
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

    <!-- PAGE 3: PILLAR DETAILS -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 3</div>
        </div>
        
        <div class="content">
            <h1>Priority Pillar Analysis</h1>
            
            ${priorityPillars.map(pillar => {
                const pillarInsights = getPillarInsights(pillar.id);
                return `
            <div class="pillar-section no-split">
                <div class="pillar-compact avoid-break">
                    <div class="pillar-header-compact">
                        <h3>${pillar.name}</h3>
                        <div>
                            <span class="pillar-score-inline">${pillar.score}%</span>
                            <span class="maturity-inline">${pillar.level}</span>
                        </div>
                    </div>
                    
                    <p class="narrative-text">${pillar.narrative}</p>
                    
                    <div class="pillar-content">
                        <div class="pillar-column">
                            <h4>Strengths Identified</h4>
                            ${pillarInsights.strengths.length > 0 ? `
                            <ul class="strength-list">
                                ${pillarInsights.strengths.slice(0, 2).map(s => `
                                <li>${s.text}</li>
                                `).join('')}
                            </ul>
                            ` : '<p style="font-size: 9pt; color: #666;">Limited strengths identified in this area.</p>'}
                        </div>
                        <div class="pillar-column">
                            <h4>Priority Improvements</h4>
                            <ul class="gap-list">
                                ${pillarInsights.gaps.slice(0, 1).map(g => `
                                <li>${g.text}</li>
                                `).join('')}
                                ${pillarInsights.gaps.length === 0 ? '<li>Continue monitoring and optimisation.</li>' : ''}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
                `;
            }).join('')}
            
            ${secondaryPillars.length > 0 ? `
            <h2>Secondary Priority Pillars</h2>
            
            ${secondaryPillars.map(pillar => {
                const pillarInsights = getPillarInsights(pillar.id);
                return `
            <div class="pillar-section no-split">
                <div class="pillar-compact avoid-break">
                    <div class="pillar-header-compact">
                        <h3>${pillar.name}</h3>
                        <div>
                            <span class="pillar-score-inline">${pillar.score}%</span>
                            <span class="maturity-inline">${pillar.level}</span>
                        </div>
                    </div>
                    
                    <p class="narrative-text">${pillar.narrative}</p>
                    
                    <div class="two-column">
                        <div>
                            <h4>Strengths</h4>
                            ${pillarInsights.strengths.length > 0 ? `
                            <ul class="strength-list">
                                ${pillarInsights.strengths.slice(0, 2).map(s => `
                                <li>${s.text}</li>
                                `).join('')}
                            </ul>
                            ` : '<p style="font-size: 9pt; color: #666;">Building foundations.</p>'}
                        </div>
                        <div>
                            <h4>Priority Improvements</h4>
                            <ul class="gap-list">
                                ${pillarInsights.gaps.slice(0, 1).map(g => `
                                <li>${g.text}</li>
                                `).join('')}
                                ${pillarInsights.gaps.length === 0 ? '<li>Continue current progress.</li>' : ''}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
                `;
            }).join('')}
            ` : ''}
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

    <!-- PAGE 4: ADDITIONAL PILLAR DETAILS -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 4</div>
        </div>
        
        <div class="content">
            <h1>Established Capability Pillars</h1>
            
            ${strengthPillars.map(pillar => {
                const pillarInsights = getPillarInsights(pillar.id);
                return `
            <div class="pillar-compact avoid-break">
                <div class="pillar-header-compact">
                    <h3>${pillar.name}</h3>
                    <div>
                        <span class="pillar-score-inline">${pillar.score}%</span>
                        <span class="maturity-inline">${pillar.level}</span>
                    </div>
                </div>
                
                <p class="narrative-text">${pillar.narrative}</p>
                
                <div class="pillar-content">
                    <div class="pillar-column">
                        <h4>Strengths Identified</h4>
                        <ul class="strength-list">
                            ${pillarInsights.strengths.slice(0, 3).map(s => `
                            <li>${s.text}</li>
                            `).join('')}
                            ${pillarInsights.strengths.length === 0 ? '<li>Consistent performance maintained.</li>' : ''}
                        </ul>
                    </div>
                    <div class="pillar-column">
                        <h4>Improvement Opportunities</h4>
                        <ul class="gap-list">
                            ${pillarInsights.gaps.length > 0 ? 
                                pillarInsights.gaps.slice(0, 3).map(g => `<li>${g.text}</li>`).join('') :
                                pillar.actions.slice(0, 3).map(a => `<li>${typeof a === 'string' ? a : a.text}</li>`).join('')
                            }
                        </ul>
                    </div>
                </div>
            </div>
                `;
            }).join('')}
            
            <h2>90-Day Improvement Roadmap</h2>
            <p style="font-size: 11pt; margin-bottom: 10px;">
                The actions below are sequenced by impact and estimated effort. Higher-effort work is placed into the 30–90 day window.
            </p>
            <p style="font-size: 10pt; color: #555; font-style: italic; margin-top: 6px; margin-bottom: 16px;">
                Timeline note: the 30-day and 30–90 day recommendations reflect priority sequencing based on impact and estimated effort.
                Actual delivery time may vary depending on resourcing, dependencies, and organisational change capacity.
            </p>
            
            ${timedActions ? `
                <div class="roadmap-phase no-split">
                    <div class="info-box avoid-break">
                        <h3 style="margin-top: 0;">Next 30 Days – Immediate Priorities</h3>
                        ${timedActions.rationale ? `<p style="font-size: 9pt; margin-bottom: 12px; color: #666; font-style: italic;">Prioritization: ${timedActions.rationale}</p>` : ''}
                        ${timedActions.immediate.length === 0
                            ? '<p style="font-size: 11pt; margin-bottom: 0;">No specific 30-day actions have been identified. Focus on maintaining existing capabilities and preparing for the 30–90 day initiatives.</p>'
                            : (() => {
                                const grouped = timedActions.immediate.reduce((acc, a) => {
                                    const pillarName = a.pillarName;
                                    if (!acc[pillarName]) acc[pillarName] = [];
                                    acc[pillarName].push(a);
                                    return acc;
                                }, {});
                                return Object.entries(grouped).map(([pillarName, actions]) => `
                                    <div class="roadmap-pillar no-split">
                                        <h4 style="color: #2B4F72; margin: 8px 0 4px 0; font-size: 11pt;">${pillarName}</h4>
                                        <ul class="action-list">
                                            ${actions.slice(0, 3).map(a => `
                                                <li style="margin-bottom: 4px;">${a.text} <span style="color: #6b7280; font-size: 10pt;">(Effort: ${a.effort})</span></li>
                                            `).join('')}
                                        </ul>
                                    </div>`).join('');
                            })()
                        }
                    </div>
                </div>
                
                <div class="roadmap-phase no-split">
                    <div class="info-box avoid-break">
                        <h3 style="margin-top: 0;">30–90 Days – Structured Uplift</h3>
                        ${timedActions.shortTerm.length === 0
                            ? '<p style="font-size: 11pt; margin-bottom: 0;">No additional actions identified beyond the immediate priorities.</p>'
                            : (() => {
                                const grouped = timedActions.shortTerm.reduce((acc, a) => {
                                    const pillarName = a.pillarName;
                                    if (!acc[pillarName]) acc[pillarName] = [];
                                    acc[pillarName].push(a);
                                    return acc;
                                }, {});
                                return Object.entries(grouped).map(([pillarName, actions]) => `
                                    <div class="roadmap-pillar no-split">
                                        <h4 style="color: #2B4F72; margin: 8px 0 4px 0; font-size: 11pt;">${pillarName}</h4>
                                        <ul class="action-list">
                                            ${actions.slice(0, 2).map(a => `
                                                <li style="margin-bottom: 4px;">${a.text} <span style="color: #6b7280; font-size: 10pt;">(Effort: ${a.effort})</span></li>
                                            `).join('')}
                                        </ul>
                                    </div>`).join('');
                            })()
                        }
                    </div>
                </div>
                
                <div class="roadmap-phase no-split">
                    <div class="info-box avoid-break">
                        <h3 style="margin-top: 0;">Ongoing Optimisation</h3>
                        <p style="font-size: 11pt; margin-bottom: 8px; font-style: italic;">Maintain and enhance your stronger capabilities.</p>
                        <ul style="font-size: 10pt; margin: 0; padding-left: 16px; page-break-inside: avoid;">
                            <li style="margin-bottom: 4px;">Conduct quarterly capability reviews</li>
                            <li style="margin-bottom: 4px;">Establish continuous improvement processes</li>
                            <li style="margin-bottom: 4px;">Monitor performance metrics and KPIs</li>
                            <li style="margin-bottom: 4px;">Plan strategic technology investments</li>
                        </ul>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

    <!-- PAGE 5: FRAMEWORK GUIDANCE (SCORE-BASED) -->
    <div class="page">
        <div class="page-header">
            <div class="logo-small">INTEGRALIS</div>
            <div class="page-number">Page 5</div>
        </div>
        
        <div class="content">
            <h1>Framework Recommendations</h1>
            
            <p style="font-size: 11pt; margin-bottom: 16px;">The following framework recommendations are based on your assessment scores and reflect realistic readiness for each certification pathway.</p>
            
            ${recommendedFrameworks.map(framework => `
            <div class="framework-section no-split">
                <div class="info-box">
                    <h3 style="margin-top: 0;">${framework.framework} <span style="font-weight: normal; color: #666;">(Pillar-based recommendation)</span></h3>
                    ${framework.rationale ? `<p style="font-size: 9pt; margin-bottom: 8px; color: #666; font-style: italic;">${framework.rationale}</p>` : ''}
                    <p style="font-size: 10pt; margin-bottom: 8px;"><strong>Posture:</strong> ${framework.tier}</p>
                    <p style="font-size: 11pt; margin-bottom: 8px;">${framework.guidance}</p>
                    <p style="font-size: 11pt; margin-bottom: 8px;"><strong>Timeline:</strong> ${framework.timeline || 'Contact us for detailed timeline planning'}</p>
                    ${framework.next_steps && framework.next_steps.length > 0 ? `
                    <p style="font-size: 10pt; margin-bottom: 4px;"><strong>Next Steps:</strong></p>
                    <ul style="font-size: 10pt; margin-bottom: 0;">
                        ${framework.next_steps.slice(0, 4).map(step => `<li>${step}</li>`).join('')}
                    </ul>
                    ` : ''}
                </div>
            </div>
            `).join('')}
            
            <h2>How Integralis Can Help</h2>
            
            <div style="page-break-inside: avoid;">
                <div style="background: #e8f4f8; padding: 14px; border-radius: 4px; margin: 12px 0;">
                    <p style="font-size: 11pt; margin-bottom: 8px;"><strong>Based on your assessment results, ${priorityPillars.length > 0 ? `the area where we can provide quickest impact is ${priorityPillars[0].name}` : 'we can help optimise your strongest capabilities and address any remaining gaps'}.</strong></p>
                    <p style="font-size: 11pt; margin-bottom: 0;">${priorityPillars.length > 0 ? `We can help establish ${priorityPillars[0].name} controls and begin framework alignment within 30-60 days.` : 'We can help maintain your strong performance and plan advanced improvements.'}</p>
                </div>
                
                <p style="font-size: 11pt; margin-top: 14px; margin-bottom: 8px;"><strong>Our services include:</strong></p>
                <ul style="font-size: 10pt; margin-bottom: 12px; page-break-inside: avoid;">
                    <li>Cyber security gap assessments and Essential 8/SMB1001 implementation</li>
                    <li>ITSM design, implementation, and maturity uplift</li>
                    <li>Technical infrastructure assessment and modernisation</li>
                    <li>Managed security services and ongoing operational support</li>
                </ul>
            </div>
            
            <div class="final-section no-split" style="margin-top: 40px; page-break-before: auto; page-break-inside: avoid; min-height: 120px;">
                <div class="info-box" style="margin-bottom: 16px; background: #e8f4f8; border-left: 4px solid #2B4F72;">
                    <h3 style="margin-top: 0;">Next Step: Discuss Your Results</h3>
                    <p style="font-size: 11pt; margin-bottom: 8px;">
                        If you'd like a walkthrough of your assessment results or help shaping your 30–90 day plan, reply to this email and we'll offer a few time options that work for you.
                    </p>
                    <p style="font-size: 11pt; margin-bottom: 0;">
                        Or email us directly: <strong>assessment@integralis.com.au</strong>
                    </p>
                </div>
                
                <div class="info-box" style="margin-bottom: 16px;">
                    <h3 style="margin-top: 0;">Contact Information</h3>
                    <p style="font-size: 11pt; margin-bottom: 0;">
                        <strong>Email:</strong> assessment@integralis.com.au<br>
                        <strong>Website:</strong> www.integralis.com.au
                    </p>
                </div>
                
                <div style="padding: 12px; border-top: 2px solid #2B4F72; text-align: center; background: #f8f9fa;">
                    <p style="font-size: 11pt; color: #666; margin: 0;">
                        <strong>Thank you for completing the IT & Cyber Capability Assessment</strong><br>
                        Report generated ${date} for ${organisation}
                    </p>
                </div>
            </div>
        </div>
        
        <div class="page-footer">
            Confidential - Prepared for ${organisation} | © 2025 Integralis
        </div>
    </div>

</body>
</html>
    `;
}

// Get default improvement suggestions for pillars with no specific gaps identified
function getDefaultImprovements(pillarName, level) {
    const improvements = {
        'ITSM & Service Management Maturity': {
            'Foundational': [
                'Document core ITSM processes for incident, request, and change management',
                'Create a foundational service catalog for users',
                'Introduce basic SLAs and begin tracking performance'
            ],
            'Developing': [
                'Strengthen governance around change and escalation processes',
                'Expand knowledge base with searchable documentation',
                'Improve SLA tracking and introduce regular performance reviews'
            ]
        },
        'Cyber Readiness': {
            'Foundational': [
                'Implement MFA for all staff and administrators',
                'Deploy endpoint protection across all devices',
                'Establish reliable, secure backups and test recovery'
            ],
            'Developing': [
                'Fully enforce MFA for all privileged accounts',
                'Expand endpoint protection to uncovered devices',
                'Increase frequency and reliability of backup testing'
            ]
        },
        'Business Process & Automation': {
            'Foundational': [
                'Document core business processes and operating procedures',
                'Identify manual processes with highest time impact',
                'Introduce foundational workflow tools for automation'
            ],
            'Developing': [
                'Expand automation to multi-step workflows and approvals',
                'Improve data flow between systems by aligning integration',
                'Update training materials to reflect new processes'
            ]
        },
        'Operational Excellence': {
            'Foundational': [
                'Establish core monitoring and alerting for critical systems',
                'Document basic operating procedures for routine tasks',
                'Identify high-frequency manual tasks suitable for automation'
            ],
            'Developing': [
                'Expand monitoring coverage and establish performance baselines',
                'Automate multi-step operational tasks and checks',
                'Introduce intelligent rules to reduce manual workload'
            ]
        },
        'Technical Capability Foundations': {
            'Foundational': [
                'Introduce strong identity lifecycle management with access controls',
                'Deploy central device management and enforce security baselines',
                'Document network segmentation strategy and implement controls'
            ],
            'Developing': [
                'Strengthen cloud readiness planning across applications',
                'Improve platform governance including admin roles and procedures',
                'Enhance backup and DR testing to meet RTO/RPO targets'
            ]
        }
    };
    
    const pillarImprovements = improvements[pillarName] || {};
    const levelImprovements = pillarImprovements[level] || ['Establish foundational controls', 'Improve governance and consistency', 'Identify automation opportunities'];
    
    return levelImprovements.map(improvement => 
        `<li style="margin-bottom: 5px;">${improvement}</li>`
    ).join('');
}

// Get default improvement suggestions with warning icons for email
function getDefaultImprovementsWithIcons(pillarName, level) {
    const improvements = {
        'ITSM & Service Management Maturity': {
            'Foundational': [
                'Document core ITSM processes for incident, request, and change management',
                'Create a foundational service catalog for users',
                'Introduce basic SLAs and begin tracking performance'
            ],
            'Developing': [
                'Strengthen governance around change and escalation processes',
                'Expand knowledge base with searchable documentation',
                'Improve SLA tracking and introduce regular performance reviews'
            ]
        },
        'Cyber Readiness': {
            'Foundational': [
                'Implement MFA for all staff and administrators',
                'Deploy endpoint protection across all devices',
                'Establish reliable, secure backups and test recovery'
            ],
            'Developing': [
                'Fully enforce MFA for all privileged accounts',
                'Expand endpoint protection to uncovered devices',
                'Increase frequency and reliability of backup testing'
            ]
        },
        'Business Process & Automation': {
            'Foundational': [
                'Document core business processes and operating procedures',
                'Identify manual processes with highest time impact',
                'Introduce foundational workflow tools for automation'
            ],
            'Developing': [
                'Expand automation to multi-step workflows and approvals',
                'Improve data flow between systems by aligning integration',
                'Update training materials to reflect new processes'
            ]
        },
        'Operational Excellence': {
            'Foundational': [
                'Establish core monitoring and alerting for critical systems',
                'Document basic operating procedures for routine tasks',
                'Identify high-frequency manual tasks suitable for automation'
            ],
            'Developing': [
                'Expand monitoring coverage and establish performance baselines',
                'Automate multi-step operational tasks and checks',
                'Introduce intelligent rules to reduce manual workload'
            ]
        },
        'Technical Capability Foundations': {
            'Foundational': [
                'Introduce strong identity lifecycle management with access controls',
                'Deploy central device management and enforce security baselines',
                'Document network segmentation strategy and implement controls'
            ],
            'Developing': [
                'Strengthen cloud readiness planning across applications',
                'Improve platform governance including admin roles and procedures',
                'Enhance backup and DR testing to meet RTO/RPO targets'
            ]
        }
    };
    
    const pillarImprovements = improvements[pillarName] || {};
    const levelImprovements = pillarImprovements[level] || ['Establish foundational controls', 'Improve governance and consistency', 'Identify automation opportunities'];
    
    return levelImprovements.map(improvement => 
        `<li style="margin-bottom: 5px;"><span style="color: #dc3545;">⚠</span> ${improvement}</li>`
    ).join('');
}

// Send email with results in body (PDF disabled)
async function sendEmail(toEmail, toName, organisation, pdfBuffer, reportData) {
    // Generate a clean text summary for email
    const { contactName, organisation: safeOrganisation, contactPhone, orgSize, industry, scores, overallLevel, insights, recommendedFrameworks, roadmapPhases, timedActions, topActions, tracking, answers } = reportData;
    
    // Sort pillars by score for email display
    const sortedPillars = [...scores.pillars].sort((a, b) => a.score - b.score);
    const priorityPillars = sortedPillars.filter(p => p.score <= 40);
    const otherPillars = sortedPillars.filter(p => p.score > 40);
    const secondaryPillars = sortedPillars.filter(p => p.score > 40 && p.score <= 60);
    const establishedPillars = sortedPillars.filter(p => p.score > 60);
    
    // Define variables for email template
    const hasCriticalGaps = insights.gaps && insights.gaps.length > 0;
    let topIssues;
    
    if (hasCriticalGaps) {
        // If there are gaps (≤40%), show only those
        topIssues = insights.gaps.slice(0, 5);
    } else if (insights.upliftAreas && insights.upliftAreas.length > 0) {
        // If no gaps but upliftAreas (41-60) exist, show 3-5 of them
        // Sort by score (lowest first) for priority
        topIssues = insights.upliftAreas
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);
    } else {
        // Only show generic message if neither gaps nor upliftAreas exist
        topIssues = [];
    }
    
    // Helper function to get generic strength text based on pillar score
    const getGenericPillarStrengthText = (pillarScore) => {
        if (pillarScore >= 80) return 'Strong, consistently applied practices are in place.';
        if (pillarScore >= 55) return 'Foundational and some advanced practices exist, but further consistency is needed before they can be considered standout strengths.';
        if (pillarScore >= 40) return 'Foundational practices exist but are not yet consistently applied across the organisation.';
        return 'Limited strengths identified in this area.';
    };
    
    // Helper to transform strength text into action-oriented optimisation text
    const transformToOptimisationText = (strengthText, label) => {
        // Common transformations for action-oriented language
        const transformations = {
            // Device management
            'managed via a central platform': 'Expand device management to cover 100% of endpoints and standardise baseline configurations',
            'centrally managed': 'Extend centralised management to all device types and automate compliance checking',
            
            // Recovery and backups
            'dependable and tested': 'Increase the frequency and scope of recovery testing to include complex, multi-system scenarios',
            'reliable and tested': 'Automate recovery testing and expand to cover edge cases and disaster scenarios',
            
            // Service desk / ITSM
            'well-documented and followed': 'Introduce XLAs linked to user satisfaction and business outcomes',
            'structured and reliable': 'Automate handoffs and approvals to further reduce handling time and manual rework',
            
            // MFA and identity
            'fully enforced': 'Extend conditional access policies and implement risk-based authentication',
            'centralised with strong': 'Integrate identity lifecycle events with downstream systems to eliminate manual access changes',
            
            // Compliance and baselines
            'well-defined and consistently': 'Automate compliance checks and integrate results into risk reporting dashboards',
            'clear governance': 'Introduce continuous control monitoring to reduce reliance on periodic manual reviews',
            
            // Patching
            'consistently performed': 'Automate patch deployment and reduce mean time to patch for critical vulnerabilities',
            'defined schedule': 'Implement zero-downtime patching strategies and automated rollback capabilities',
            
            // General patterns
            'in place': 'Enhance automation and expand coverage to eliminate remaining manual processes',
            'documented': 'Digitise documentation and implement automated validation of procedures',
            'consistent': 'Standardise across all business units and implement continuous improvement metrics',
            'reliable': 'Implement predictive analytics and proactive remediation capabilities',
            'established': 'Mature the process with automation and integrate with broader ecosystem'
        };
        
        // Check for specific patterns and return optimised text
        for (const [pattern, replacement] of Object.entries(transformations)) {
            if (strengthText.toLowerCase().includes(pattern.toLowerCase())) {
                return replacement;
            }
        }
        
        // Generic fallback transformations based on keywords
        if (strengthText.includes('enforced') || strengthText.includes('implemented')) {
            return `Expand and automate ${label.toLowerCase()} to achieve full coverage and reduce manual overhead`;
        }
        if (strengthText.includes('documented') || strengthText.includes('defined')) {
            return `Mature ${label.toLowerCase()} through automation and continuous improvement practices`;
        }
        if (strengthText.includes('process') || strengthText.includes('procedure')) {
            return `Optimise ${label.toLowerCase()} with automation, metrics, and predictive capabilities`;
        }
        
        // Ultimate fallback
        return `Further enhance ${label.toLowerCase()} through automation and process optimisation`;
    };
    
    // Helper to get pillar-specific insights for email
    const getPillarInsights = (pillarId, topPriorityIssues = []) => {
        const questionsData = require('./config/questions.json');
        const pillarsData = require('./config/pillars.json');
        
        // Get the pillar average score
        const pillarQuestions = Object.values(questionsData).filter(q => q.pillar_id === pillarId);
        const pillarScores = pillarQuestions.map(q => answers[`q${q.id}`] ?? 0);
        const pillarAvg = pillarScores.length > 0 ? Math.round(pillarScores.reduce((a,b) => a+b, 0) / pillarScores.length) : 0;
        
        // Count how many questions in this pillar are ≥80%
        const highScoreCount = pillarScores.filter(s => s >= 80).length;

        const scored = pillarQuestions.map(q => {
            const score = answers[`q${q.id}`] ?? 0;
            return { question: q, score };
        });

        // Get all issues (gaps + uplift) to check for thematic conflicts
        const allIssues = scored.filter(item => item.score <= 60);
        const issueThemes = new Set();
        
        // Check for backup/DR related issues
        allIssues.forEach(item => {
            const label = item.question.short_label.toLowerCase();
            if (label.includes('backup') || label.includes('dr') || label.includes('recovery')) {
                issueThemes.add('backup_dr');
            }
            if (label.includes('security') && label.includes('configuration')) {
                issueThemes.add('security_config');
            }
        });

        // Strengths: ≥80 (simplified logic for email)
        const strengths = scored
            .filter(item => {
                if (item.score < 80) {
                    return false;
                }
                
                // Prevent thematic contradictions
                const label = item.question.short_label.toLowerCase();
                if (issueThemes.has('backup_dr') && 
                    (label.includes('backup') || label.includes('dr') || label.includes('recovery'))) {
                    return false;
                }
                if (issueThemes.has('security_config') && 
                    label.includes('security') && label.includes('configuration')) {
                    return false;
                }
                
                return true;
            })
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.strength_text,
                score: item.score
            }));

        // Get pillar name for matching with topPriorityIssues
        const pillarName = pillarsData[pillarId]?.name || pillarId;
        
        // Find any top priority issues that belong to this pillar
        const pillarTopIssues = topPriorityIssues.filter(issue => issue.pillar === pillarName);
        
        const gaps = scored
            .filter(item => item.score <= 40)
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.gap_text,
                score: item.score
            }));

        const upliftAreas = scored
            .filter(item => item.score > 40 && item.score <= 60)
            .sort((a, b) => a.score - b.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.gap_text,
                score: item.score
            }));
            
        // Ensure any top priority issues for this pillar are included
        pillarTopIssues.forEach(topIssue => {
            // Check if this issue is already in gaps or upliftAreas
            const isInGaps = gaps.some(g => g.text === topIssue.text);
            const isInUplift = upliftAreas.some(u => u.text === topIssue.text);
            
            if (!isInGaps && !isInUplift) {
                // Add it to the appropriate list based on score
                if (topIssue.score <= 40) {
                    gaps.push({
                        label: topIssue.label,
                        text: topIssue.text,
                        score: topIssue.score
                    });
                } else if (topIssue.score <= 60) {
                    upliftAreas.push({
                        label: topIssue.label,
                        text: topIssue.text,
                        score: topIssue.score
                    });
                }
            }
        });
        
        // Re-sort after adding top priority issues
        gaps.sort((a, b) => a.score - b.score);
        upliftAreas.sort((a, b) => a.score - b.score);

        // Optimisation areas: 61-79 (updated range)
        const optimisationAreas = scored
            .filter(item => item.score > 60 && item.score < 80)
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                label: item.question.short_label,
                text: transformToOptimisationText(item.question.strength_text, item.question.short_label),
                score: item.score
            }));
            
        // Emerging strengths for fallback display (still 70-79%)
        const emergingStrengths = scored
            .filter(item => item.score >= 70 && item.score < 80)
            .sort((a, b) => b.score - a.score)
            .map(item => ({
                label: item.question.short_label,
                text: item.question.strength_text,
                score: item.score
            }));

        return { strengths, gaps, upliftAreas, optimisationAreas, emergingStrengths };
    };
    
    const bccEmail = process.env.BCC_EMAIL || 'kelly.pellas@integralis.com.au';
    const msg = {
        to: toEmail,
        from: {
            email: process.env.FROM_EMAIL || 'assessment@integralis.com.au',
            name: process.env.FROM_NAME || 'Integralis Assessment Team'
        },
        subject: `Your IT Capability Assessment Results - ${organisation}`,
        html: `
<!-- Outer wrapper table for email client compatibility -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td align="center">
            <table role="presentation" width="750" cellpadding="0" cellspacing="0" border="0" style="max-width:750px; border-collapse:collapse;">
                
                <!-- Header: logo + title with background -->
                <tr>
                    <td align="center" bgcolor="#f5f7fa" style="padding:25px 0 25px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; max-width:750px;">
                            <tr>
                                <td align="left" valign="middle" style="padding:0 40px; font-family:Arial, sans-serif;">
                                    <img src="${process.env.URL || 'https://integralis-assessment.netlify.app'}/logo.png"
                                         alt="Integralis"
                                         width="161"
                                         style="display:block; border:0; outline:none; text-decoration:none;">
                                </td>
                                <td align="right" valign="middle" style="padding:0 40px; font-family:Arial, sans-serif; color:#1f4465; font-size:14px;">
                                    IT & Cyber Capability Assessment Results
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                        <!-- Removed base64 logo: <img src="data:image/png;base64,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" alt="Integralis" style="height:60px; margin-bottom:20px;">
                    </td>
                </tr>

                <!-- Spacer after header -->
                <tr>
                    <td style="height:16px; font-size:16px; line-height:16px;">&nbsp;</td>
                </tr>

                <!-- Greeting Section -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 20px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333; line-height:1.6;">
                        <h2 style="margin:0 0 20px 0; color:#2B4F72; font-size:20px; font-weight:600;">Hi ${toName},</h2>
                        <p style="margin:0 0 16px 0; font-size:15px; line-height:24px;">
                            Thank you for completing the <strong>IT & Cyber Capability Assessment</strong> for 
                            <strong>${organisation}</strong>. Your complete results are presented below.
                        </p>
                    </td>
                </tr>

                <!-- Executive Summary Box -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td bgcolor="#f0f4f8" style="border-left:4px solid #2B4F72; padding:20px; font-family:'Segoe UI',Arial,sans-serif;">
                                    <h3 style="margin:0 0 20px 0; color:#2B4F72; font-size:18px; font-weight:600;">Executive Summary</h3>
                                    <div style="margin:0 0 15px 0; font-size:15px; line-height:20px; color:#333;">
                                        <div><strong>Contact:</strong> ${contactName}</div>
                                        <div><strong>Organisation:</strong> ${organisation}</div>
                                        ${orgSize ? `<div><strong>Size:</strong> ${orgSize}</div>` : ''}
                                        ${industry ? `<div><strong>Industry:</strong> ${industry}</div>` : ''}
                                    </div>
                                    <p style="margin:0; font-size:15px; line-height:24px; color:#333;">
                                        <strong>Overall Maturity:</strong> ${scores.overall}% (${overallLevel.label})<br>
                                        <span style="font-style:italic; color:#555;">${overallLevel.narrative}</span>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Pillar Scores Section -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif;">
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Capability Pillar Scores</h2>
                        
                        <table role="presentation" style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="background:#234264; color:#ffffff;">
                    <th align="left" style="padding:12px 15px; font-weight:600;">Pillar</th>
                    <th align="center" style="padding:12px 15px; font-weight:600; width:70px;">Score</th>
                    <th align="left" style="padding:12px 15px; font-weight:600;">Performance</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPillars.map((p, idx) => `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
                    <td style="padding:12px 15px;">${p.name}</td>
                    
                    <!-- Numeric percentage -->
                    <td align="center" style="padding:12px 15px; font-weight:600; color:#234264;">
                        ${p.score}%
                    </td>
                    
                    <!-- Maturity label + bar -->
                    <td style="padding:12px 15px;">
                        <div style="font-size:13px; color:#6b7280; margin-bottom:2px;">
                            ${p.level}
                        </div>
                        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:2px;">
                            <tr>
                                <td width="${p.score}%" style="background:#234264; height:10px; line-height:10px; font-size:0;"></td>
                                <td width="${100 - p.score}%" style="background:#e5e7eb; height:10px; line-height:10px; font-size:0;"></td>
                            </tr>
                        </table>
                    </td>
                </tr>`).join('')}
                            </tbody>
                        </table>
                    </td>
                </tr>

                <!-- Spacer -->
                <tr>
                    <td style="height:8px; font-size:8px; line-height:8px;">&nbsp;</td>
                </tr>

                <!-- Top Priority Improvements Section -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333;">
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Top Priority Issues</h2>
                        
                        ${hasCriticalGaps ? `
                        <p style="margin:0 0 16px 0; font-size:15px; color:#4b5563; line-height:24px;">These issues are drawn from your lowest-scoring questions across all pillars and represent the areas with the highest operational risk, cost impact, or friction based on your responses.</p>
                        ` : topIssues.length > 0 ? `
                        <p style="margin:0 0 16px 0; font-size:15px; color:#4b5563; line-height:24px;">Your responses did not identify any severe gaps (≤40%). The items below represent partially implemented or inconsistently applied practices where standardising and embedding the approach will materially improve outcomes.</p>
                        ` : `
                        <p style="margin:0 0 16px 0; font-size:15px; color:#666; line-height:24px;">Your responses did not identify any severe gaps or partially implemented areas. At this maturity level, the focus is on ongoing optimisation and continuous improvement rather than specific remediation items.</p>
                        `}
                        
                        ${topIssues.length > 0 ? `
                        <ul style="margin:0; padding-left:20px; font-size:15px; line-height:24px;">
                            ${topIssues.map(issue => `
                                <li style="margin-bottom:8px;">${issue.text} <span style="color:#777; font-style:italic;">(${issue.pillar})</span></li>
                            `).join('')}
                        </ul>
                        ` : ``}
                    </td>
                </tr>

                <!-- Key Strengths Section -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333;">
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Key Strengths</h2>
                        ${insights.strengths && insights.strengths.length >= 2 ? `
                        <ul style="margin:0; padding-left:20px; font-size:15px; line-height:24px;">
                            ${insights.strengths.slice(0,5).map(s => `
                                <li style="margin-bottom:8px;"><strong>${s.label}</strong>: ${s.text}</li>
                            `).join('')}
                        </ul>
                        ` : scores.overall <= 30 ? `
                        <p style="margin:0; font-size:15px; color:#666; line-height:24px;">
                            No standout strengths (≥80%) were identified. Only limited strengths could be identified at this stage; 
                            the immediate focus is on establishing and embedding core practices across the organisation.
                        </p>
                        ` : sortedPillars.some(p => p.score >= 55) ? `
                        <p style="margin:0; font-size:15px; color:#666; line-height:24px;">
                            No standout strengths (≥80%) were identified. Several areas show emerging strengths, 
                            but practices are not yet consistent or mature enough to be considered clear differentiators. 
                            The focus for now is on consolidating these emerging strengths and lifting weaker areas to the same standard.
                        </p>
                        ` : `
                        <p style="margin:0; font-size:15px; color:#666; line-height:24px;">
                            No standout strengths (≥80%) were identified. Foundational practices are in place across most areas, 
                            but they are only partially implemented or inconsistently applied. 
                            The focus for now is on standardising and embedding these practices.
                        </p>
                        `}
                    </td>
                </tr>

                <!-- Priority Pillars Section (only show if there are priority pillars) -->
                ${priorityPillars.length > 0 ? `
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333;">
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Pillars Requiring Uplift</h2>
                        <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:24px;">These pillars scored lowest and represent the highest risk and improvement opportunity. They should be the primary focus for the next 3–6 months.</p>

                        ${priorityPillars.map(pillar => {
                            const pillarInsights = getPillarInsights(pillar.id, topIssues);
                            return `
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                            <tr>
                                <td bgcolor="#f8f9fa" style="border-left:4px solid #dc3545; padding:20px; font-family:'Segoe UI',Arial,sans-serif;">
                                    <h3 style="margin:0 0 12px 0; color:#2B4F72; font-size:18px; font-weight:600; line-height:24px;">
                                        ${pillar.name} — ${pillar.score}% (${pillar.level})
                                    </h3>
                                    <p style="margin:0 0 16px 0; font-style:italic; color:#555; font-size:15px; line-height:24px;">${pillar.narrative}</p>

                                    <p style="margin:0 0 4px 0; font-weight:600; font-size:15px; line-height:24px;">Strengths</p>
                                    ${pillarInsights.strengths.length > 0 ? `
                                    <ul style="margin:0 0 16px 0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.strengths.slice(0,2).map(s => `<li style="margin-bottom:4px;">${s.text}</li>`).join('')}
                                    </ul>
                                    ` : pillarInsights.optimisationAreas && pillarInsights.optimisationAreas.length > 0 ? `
                                    <p style="margin:0 0 8px 0; font-size:15px; line-height:24px; color:#666; font-style:italic;">Emerging strengths:</p>
                                    <ul style="margin:0 0 16px 0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.optimisationAreas.slice(0,2).map(s => `<li style="margin-bottom:4px;">${s.text}</li>`).join('')}
                                    </ul>
                                    ` : `
                                    <ul style="margin:0 0 16px 0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        <li style="margin-bottom:4px;">${pillar.score <= 40 ? 'Limited strengths identified in this area.' : 'Foundational practices exist but are not yet consistently applied across the organisation.'}</li>
                                    </ul>
                                    `}

                                    <p style="margin:16px 0 4px 0; font-weight:600; font-size:15px; line-height:24px;">Improvement Areas</p>
                                    ${pillarInsights.gaps.length > 0 ? `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.gaps.slice(0,3).map(g => `<li style="margin-bottom:4px;">${g.text}</li>`).join('')}
                                    </ul>
                                    ` : pillarInsights.upliftAreas.length > 0 ? `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.upliftAreas.slice(0,3).map(g => `<li style="margin-bottom:4px;">${g.text}</li>`).join('')}
                                    </ul>
                                    ` : `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        <li style="margin-bottom:4px;">Continue strengthening governance and process maturity.</li>
                                    </ul>
                                    `}
                                </td>
                            </tr>
                        </table>`;
                        }).join('')}
                    </td>
                </tr>
                ` : ''}

                <!-- Other Pillars Section -->
                ${otherPillars.length > 0 ? `
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333;">
                        ${priorityPillars.length > 0 ? `
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Established Pillars</h2>
                        <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:24px;">These pillars are comparatively stronger. The focus here is on optimisation and avoiding regression while uplift work occurs in higher-risk areas.</p>
                        ` : `
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Pillar-by-Pillar Insights</h2>
                        <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:24px;">These insights highlight the key strengths and improvement opportunities in each pillar. The focus is on improving consistency and embedding practices across all areas.</p>
                        `}

                        ${otherPillars.map(pillar => {
                            const pillarInsights = getPillarInsights(pillar.id, topIssues);
                            return `
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                            <tr>
                                <td bgcolor="#f8f9fa" style="border-left:4px solid #2B4F72; padding:20px; font-family:'Segoe UI',Arial,sans-serif;">
                                    <h3 style="margin:0 0 12px 0; color:#2B4F72; font-size:18px; font-weight:600; line-height:24px;">
                                        ${pillar.name} — ${pillar.score}% (${pillar.level})
                                    </h3>
                                    <p style="margin:0 0 16px 0; font-style:italic; color:#555; font-size:15px; line-height:24px;">${pillar.narrative}</p>

                                    <p style="margin:0 0 4px 0; font-weight:600; font-size:15px; line-height:24px;">Strengths</p>
                                    ${pillarInsights.strengths.length > 0 ? `
                                    <ul style="margin:0 0 16px 0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.strengths.slice(0,2).map(s => `<li style="margin-bottom:4px;">${s.text}</li>`).join('')}
                                    </ul>
                                    ` : pillarInsights.optimisationAreas && pillarInsights.optimisationAreas.length > 0 ? `
                                    <p style="margin:0 0 8px 0; font-size:15px; line-height:24px; color:#666; font-style:italic;">Emerging strengths:</p>
                                    <ul style="margin:0 0 16px 0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.optimisationAreas.slice(0,2).map(s => `<li style="margin-bottom:4px;">${s.text}</li>`).join('')}
                                    </ul>
                                    ` : `
                                    <ul style="margin:0 0 16px 0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        <li style="margin-bottom:4px;">${pillar.score >= 55 ? 'Foundational and some advanced practices exist, but further consistency is needed before they can be considered standout strengths.' : getGenericPillarStrengthText(pillar.score)}</li>
                                    </ul>
                                    `}

                                    <p style="margin:16px 0 4px 0; font-weight:600; font-size:15px; line-height:24px;">Optimisation Opportunities</p>
                                    ${pillarInsights.gaps.length > 0 ? `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.gaps.slice(0,2).map(g => `<li style="margin-bottom:4px;">${g.text}</li>`).join('')}
                                    </ul>
                                    ` : pillarInsights.upliftAreas.length > 0 ? `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.upliftAreas.slice(0,2).map(g => `<li style="margin-bottom:4px;">${g.text}</li>`).join('')}
                                    </ul>
                                    ` : pillarInsights.optimisationAreas.length > 0 ? `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        ${pillarInsights.optimisationAreas.slice(0,2).map(g => `<li style="margin-bottom:4px;">${g.text}</li>`).join('')}
                                    </ul>
                                    ` : `
                                    <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                        <li style="margin-bottom:4px;">Continue current progress and look for automation and optimisation opportunities.</li>
                                    </ul>
                                    `}
                                </td>
                            </tr>
                        </table>`;
                        }).join('')}
                    </td>
                </tr>
                ` : ''}

                <!-- Improvement Roadmap Section -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333;">
                        <h2 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Improvement Roadmap</h2>
                        ${(timedActions && (timedActions.immediate.length > 0 || timedActions.shortTerm.length > 0)) ? `
                        <p style="margin:0 0 20px 0; font-size:14px; color:#4b5563; font-style:italic; line-height:22px;">
                            Timeline note: the 30-day and 30–90 day recommendations reflect priority sequencing based on impact and estimated effort.
                            Actual delivery time may vary depending on resourcing, dependencies, and organisational change capacity.
                        </p>
                        ` : `
                        <p style="margin:0 0 20px 0; font-size:15px; color:#4b5563; line-height:24px;">
                            Given your current maturity level, there are no urgent remediation actions required. The focus is on maintaining excellence through continuous improvement and strategic optimisation.
                        </p>
                        `}

        ${(timedActions && (timedActions.immediate.length > 0 || timedActions.shortTerm.length > 0)) ? `
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:30px;">
            <tr>
                <td bgcolor="#f8f9fa" style="padding:25px; border-left:4px solid #2B4F72;">
                    <div style="font-size:16px; font-weight:600; color:#2B4F72; margin-bottom:8px;">
                        Next 30 Days – Immediate Priorities
                    </div>
                    ${timedActions && timedActions.immediate && timedActions.immediate.length
                        ? (() => {
                            const grouped = timedActions.immediate.reduce((acc, a) => {
                                const pillarName = a.pillarName;
                                if (!acc[pillarName]) acc[pillarName] = [];
                                acc[pillarName].push(a);
                                return acc;
                            }, {});
                            return Object.entries(grouped).map(([pillarName, actions]) => `
                                <h4 style="color:#2B4F72; margin:12px 0 8px 0; font-size:15px; font-weight:600;">${pillarName}</h4>
                                <ul style="margin:0; padding-left:16px; font-size:15px;">
                                    ${actions.map(a => `
                                        <li style="margin-bottom:3px;">${a.text} <span style="color:#6b7280; font-size:13px;">(Effort: ${a.effort})</span></li>
                                    `).join('')}
                                </ul>`).join('');
                        })()
                        : `<p style="margin:8px 0 0 0; font-size:15px; color:#6b7280;">
                             ${timedActions && timedActions.shortTerm && timedActions.shortTerm.length > 0 
                                ? 'No specific 30-day actions identified. Focus on preparing for the 30–90 day initiatives.'
                                : 'No immediate actions required at this maturity level.'}
                           </p>`
                    }
                </td>
            </tr>
        </table>

        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:30px;">
            <tr>
                <td bgcolor="#f8f9fa" style="padding:25px; border-left:4px solid #2B4F72;">
                    <div style="font-size:16px; font-weight:600; color:#2B4F72; margin-bottom:8px;">
                        30–90 Days – Structured Uplift
                    </div>
                    ${timedActions && timedActions.shortTerm && timedActions.shortTerm.length
                        ? (() => {
                            const grouped = timedActions.shortTerm.reduce((acc, a) => {
                                const pillarName = a.pillarName;
                                if (!acc[pillarName]) acc[pillarName] = [];
                                acc[pillarName].push(a);
                                return acc;
                            }, {});
                            return Object.entries(grouped).map(([pillarName, actions]) => `
                                <h4 style="color:#2B4F72; margin:12px 0 8px 0; font-size:15px; font-weight:600;">${pillarName}</h4>
                                <ul style="margin:0; padding-left:16px; font-size:15px;">
                                    ${actions.map(a => `
                                        <li style="margin-bottom:3px;">${a.text} <span style="color:#6b7280; font-size:13px;">(Effort: ${a.effort})</span></li>
                                    `).join('')}
                                </ul>`).join('');
                        })()
                        : `<p style="margin:8px 0 0 0; font-size:15px; color:#6b7280;">
                             ${timedActions && timedActions.immediate && timedActions.immediate.length > 0
                                ? 'No additional short-term actions identified beyond the immediate priorities.'
                                : 'No structured uplift actions required at this maturity level.'}
                           </p>`
                    }
                </td>
            </tr>
        </table>
        ` : ''}

        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:30px;">
            <tr>
                <td bgcolor="#f0f8ff" style="padding:25px; border-left:4px solid #28a745;">
                    <div style="font-size:16px; font-weight:600; color:#2B4F72; margin-bottom:8px;">
                        Ongoing Optimisation
                    </div>
                    <div style="font-style:italic; margin-bottom:10px; color:#4b5563; font-size:15px;">
                        Recommendations for continuous improvement beyond the first 90 days, once immediate risks and foundational gaps have been addressed.
                    </div>
                    <ul style="margin:0; padding-left:20px; font-size:15px; color:#374151;">
                        <li style="margin-bottom:4px;">Conduct quarterly capability reviews.</li>
                        <li style="margin-bottom:4px;">Run a continuous improvement cycle for service management and security controls.</li>
                        <li style="margin-bottom:4px;">Monitor performance KPIs and adjust priorities.</li>
                        <li style="margin-bottom:4px;">Plan strategic technology investments aligned to business goals.</li>
                    </ul>
                </td>
            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Framework Recommendations Section -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif; color:#333;">
                        <h3 style="margin:0 0 16px 0; color:#2B4F72; font-size:20px; font-weight:600;">Framework Recommendations</h3>
                        <p style="margin:0 0 20px 0; font-size:15px; line-height:24px; color:#333;">
                            These recommendations are based on your capability pillar scores and indicate realistic next steps for formal alignment.
                        </p>

                        ${recommendedFrameworks.map(framework => `
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                            <tr>
                                <td bgcolor="#f8f9fa" style="border-left:3px solid #2B4F72; padding:16px; font-family:'Segoe UI',Arial,sans-serif;">
                                    <h4 style="margin:0 0 8px 0; color:#2B4F72; font-size:16px; font-weight:600;">${framework.framework}</h4>
                                    ${framework.rationale ? `<p style="margin:0 0 8px 0; font-size:14px; line-height:20px; color:#666; font-style:italic;">${framework.rationale}</p>` : ''}
                                    <p style="margin:0 0 8px 0; font-size:15px; line-height:24px; color:#333;">
                                        <strong>Posture:</strong> ${framework.tier}
                                    </p>
                                    <p style="margin:0 0 8px 0; font-size:15px; line-height:24px; color:#333;">${framework.guidance}</p>
                                    ${framework.timeline
                                        ? `<p style="margin:0 0 8px 0; font-size:15px; line-height:24px; color:#333;"><strong>Timeline:</strong> ${framework.timeline}</p>`
                                        : ''
                                    }
                                    ${framework.next_steps && framework.next_steps.length
                                        ? `<p style="margin:0 0 4px 0; font-size:15px; font-weight:600; line-height:24px; color:#333;">Next steps:</p>
                                           <ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:24px;">
                                             ${framework.next_steps.map(step => `
                                               <li style="margin-bottom:4px;">${step}</li>
                                             `).join('')}
                                           </ul>`
                                        : ''
                                    }
                                </td>
                            </tr>
                        </table>
                        `).join('')}
                    </td>
                </tr>

                <!-- Next Steps CTA -->
                <tr>
                    <td bgcolor="#ffffff" style="padding:0 35px 35px 35px; font-family:'Segoe UI',Arial,sans-serif;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td bgcolor="#e8f4f8" style="border-left:3px solid #2B4F72; padding:16px; font-family:'Segoe UI',Arial,sans-serif;">
                                    <h3 style="margin:0 0 16px 0; color:#2B4F72; font-size:18px; font-weight:600;">Next Step: Discuss Your Results</h3>
                                    <p style="margin:0 0 12px 0; font-size:15px; color:#333; line-height:24px;">
                                        If you'd like a walkthrough of your assessment results or help shaping your 30–90 day plan, reply to this email and we'll offer a few time options that work for you.
                                    </p>
                                    <p style="margin:0; font-size:15px; color:#333; line-height:24px;">
                                        Or email us directly: <strong>assessment@integralis.com.au</strong>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                    <td bgcolor="#f8f9fa" style="padding:20px; text-align:center; font-family:'Segoe UI',Arial,sans-serif; color:#666; font-size:15px; line-height:24px;">
                        <p style="margin:0;">© 2025 Integralis</p>
                    </td>
                </tr>
                
            </table>
        </td>
    </tr>
</table>
        `
    };

    // Add BCC only if different from TO address to avoid SendGrid duplicate error
    if (bccEmail && bccEmail.toLowerCase() !== toEmail.toLowerCase()) {
        msg.bcc = bccEmail;
    }

    try {
        await sgMail.send(msg);
        console.log('✅ Email sent successfully to:', toEmail);
        
        // Send separate internal tracking email if tracking data exists
        if (tracking) {
            const trackingRecipients = ['kelly.pellas@integralis.com.au', 'assessment@integralis.com.au'];
            for (const recipient of trackingRecipients) {
                await sendTrackingEmail(recipient, {
                contactName,
                organisation: safeOrganisation,
                contactEmail: toEmail,
                contactPhone,
                orgSize,
                industry,
                scores,
                overallLevel,
                tracking,
                answers: answers
                });
            }
        }
    } catch (error) {
        console.error('❌ SendGrid Error Details:', error.response?.body || error.message);
        if (error.response?.body?.errors) {
            console.error('SendGrid Errors:', error.response.body.errors);
        }
        throw error;
    }
}

// Send internal tracking email
async function sendTrackingEmail(toEmail, data) {
    const { contactName, organisation, contactEmail, contactPhone, orgSize, industry, scores, overallLevel, tracking, answers } = data;
    
    // Get the original answers and format with questions
    const questionsWithAnswers = answers ? await formatQuestionsWithAnswers(answers) : 'No detailed answers available';
    
    const trackingMsg = {
        to: toEmail,
        from: {
            email: process.env.FROM_EMAIL || 'assessment@integralis.com.au',
            name: process.env.FROM_NAME || 'Integralis Assessment Team'
        },
        subject: `[${tracking?.sessionId || 'unknown'}] Detailed Requested - ${contactName} (${organisation})`,
        html: `
        <h2>Assessment Tracking Details</h2>
        <p><strong>Session ID:</strong> ${tracking?.sessionId || 'unknown'}</p>
        
        <h3>Contact Information:</h3>
        <ul>
            <li><strong>Name:</strong> ${contactName}</li>
            <li><strong>Email:</strong> ${contactEmail}</li>
            <li><strong>Organisation:</strong> ${organisation}</li>
            ${contactPhone ? `<li><strong>Phone:</strong> ${contactPhone}</li>` : ''}
            ${orgSize ? `<li><strong>Size:</strong> ${orgSize}</li>` : ''}
            ${industry ? `<li><strong>Industry:</strong> ${industry}</li>` : ''}
        </ul>
        
        <h3>Assessment Results:</h3>
        <ul>
            <li><strong>Overall Score:</strong> ${scores.overall}% (${overallLevel.label})</li>
            ${Object.values(scores.pillars).map(pillar => 
                `<li><strong>${pillar.name}:</strong> ${pillar.score}% (${pillar.level})</li>`
            ).join('')}
        </ul>
        
        <h3>Traffic Source & Tracking:</h3>
        <ul>
            <li><strong>Referrer:</strong> ${tracking.referrer}</li>
            <li><strong>Landing Time:</strong> ${new Date(tracking.landingTime).toLocaleString()}</li>
            <li><strong>Completion Time:</strong> ${new Date(tracking.completionTime).toLocaleString()}</li>
            <li><strong>Time on Site:</strong> ${Math.round((new Date(tracking.completionTime) - new Date(tracking.landingTime)) / 1000 / 60)} minutes</li>
            ${tracking.urlParams && Object.keys(tracking.urlParams).length > 0 ? 
                `<li><strong>Campaign Data:</strong><ul>
                    ${Object.entries(tracking.urlParams).map(([key, value]) => `<li>${key}: ${value}</li>`).join('')}
                 </ul></li>` : 
                '<li><strong>Campaign Data:</strong> None</li>'
            }
            <li><strong>User Agent:</strong> ${tracking.userAgent}</li>
        </ul>
        
        <h3>Detailed Q&A Responses:</h3>
        <div style="font-family:monospace; font-size:12px; max-height:400px; overflow-y:auto; border:1px solid #ddd; padding:10px; background:#f9f9f9;">
            ${questionsWithAnswers}
        </div>
        
        <p><em>This is an internal tracking email. The customer received a clean copy of their assessment results.</em></p>
        `
    };

    try {
        await sgMail.send(trackingMsg);
        console.log('✅ Tracking email sent to:', toEmail);
    } catch (error) {
        console.error('❌ Tracking email failed:', error.response?.body || error.message);
        // Don't throw - tracking email failure shouldn't break main flow
    }
}

// Load questions and format with answers
async function formatQuestionsWithAnswers(answers) {
    try {
        const questionsPath = path.join(process.cwd(), 'public', 'config', 'questions.json');
        const descriptorsPath = path.join(process.cwd(), 'public', 'config', 'level-descriptors.json');
        
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

