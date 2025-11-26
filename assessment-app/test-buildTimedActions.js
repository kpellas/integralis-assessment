// Unit tests for buildTimedActions function  
// Run with: node test-buildTimedActions.js

// Copy the actual implementation from generateReport.js
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

// Mock telemetry function
function emitTelemetry(eventName, payload) {
    // Silent for tests
}

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

    return {
        immediate,
        shortTerm,
        ongoing,
        rationale: rationale.join('; '),
        metadata: {
            effortUsed30,
            overflowUsed,
            securityOverrideApplied,
            pillarCounts: immediate.reduce((acc, item) => {
                acc[item.pillarName] = (acc[item.pillarName] || 0) + 1;
                return acc;
            }, {})
        }
    };
}

// Test scenarios
function runTests() {
    console.log('🧪 Running buildTimedActions Unit Tests\n');

    // Test 1: Low security override scenario
    console.log('Test 1: Low security override (SECURITY 35%)');
    const lowSecurityScores = {
        pillars: [
            { 
                id: 'SECURITY', 
                name: 'Security', 
                score: 35,
                level: 'Foundational',
                actions: [
                    { text: 'Implement MFA', effort: 'low' },
                    { text: 'Update antivirus', effort: 'medium' },
                    { text: 'Security audit', effort: 'high' }
                ]
            },
            { 
                id: 'GOVERNANCE', 
                name: 'Governance', 
                score: 60,
                level: 'Developing',
                actions: [
                    { text: 'Document IT policies', effort: 'medium' },
                    { text: 'Risk assessment', effort: 'high' }
                ]
            },
            { 
                id: 'ITSM', 
                name: 'ITSM', 
                score: 45,
                level: 'Developing',
                actions: [
                    { text: 'Setup service desk', effort: 'medium' },
                    { text: 'Define SLAs', effort: 'low' }
                ]
            },
            { 
                id: 'CORE_IT_OPERATIONS', 
                name: 'Operations', 
                score: 55,
                level: 'Developing',
                actions: [
                    { text: 'Automate backups', effort: 'low' },
                    { text: 'Monitoring setup', effort: 'medium' }
                ]
            }
        ]
    };

    const result1 = buildTimedActions(lowSecurityScores);
    console.log(`✓ Immediate actions count: ${result1.immediate.length}`);
    console.log(`✓ Total effort: ${result1.metadata.effortUsed30}`);
    console.log(`✓ Overflow used: ${result1.metadata.overflowUsed}`);
    console.log(`✓ Security override applied: ${result1.metadata.securityOverrideApplied}`);
    
    const securityActions = result1.immediate.filter(a => a.pillarId === 'SECURITY');
    console.log(`✓ Security actions in immediate: ${securityActions.length}`);
    
    const hasSecurityOverride = result1.immediate.some(a => a.reason === 'security_override');
    console.log(`✓ Has security override reason: ${hasSecurityOverride}`);
    
    console.log(`✓ Overflow ≤ 1: ${result1.metadata.overflowUsed <= 1}`);
    console.log('Actions:', result1.immediate.map(a => `${a.text} (${a.reason}, effort: ${a.effort})`));
    console.log('');

    // Test 2: Balanced case scenario
    console.log('Test 2: Balanced case (all pillars ~50-60%)');
    const balancedScores = {
        pillars: [
            { 
                id: 'SECURITY', 
                name: 'Security', 
                score: 55,
                level: 'Developing',
                actions: [
                    { text: 'Implement MFA', effort: 'low' },
                    { text: 'Update antivirus', effort: 'medium' }
                ]
            },
            { 
                id: 'GOVERNANCE', 
                name: 'Governance', 
                score: 50,
                level: 'Developing',
                actions: [
                    { text: 'Document IT policies', effort: 'medium' },
                    { text: 'Risk assessment', effort: 'high' }
                ]
            },
            { 
                id: 'ITSM', 
                name: 'ITSM', 
                score: 60,
                level: 'Established',
                actions: [
                    { text: 'Setup service desk', effort: 'medium' },
                    { text: 'Define SLAs', effort: 'low' }
                ]
            },
            { 
                id: 'CORE_IT_OPERATIONS', 
                name: 'Operations', 
                score: 52,
                level: 'Developing',
                actions: [
                    { text: 'Automate backups', effort: 'low' },
                    { text: 'Monitoring setup', effort: 'medium' }
                ]
            }
        ]
    };

    const result2 = buildTimedActions(balancedScores);
    console.log(`✓ Immediate actions count: ${result2.immediate.length}`);
    console.log(`✓ Total effort: ${result2.metadata.effortUsed30}`);
    console.log(`✓ Count 3-4: ${result2.immediate.length >= 3 && result2.immediate.length <= 4}`);
    
    const pillarCounts = Object.values(result2.metadata.pillarCounts);
    const maxPerPillar = pillarCounts.length > 0 ? Math.max(...pillarCounts) : 0;
    console.log(`✓ Max per pillar: ${maxPerPillar} (should be ≤ 2)`);
    console.log(`✓ Max per pillar ≤ 2: ${maxPerPillar <= 2}`);
    console.log(`✓ Security override applied: ${result2.metadata.securityOverrideApplied}`);
    console.log('Pillar distribution:', result2.metadata.pillarCounts);
    console.log('Actions:', result2.immediate.map(a => `${a.text} (${a.reason}, effort: ${a.effort})`));
    console.log('');

    // Test 3: Scarce actions scenario with high effort
    console.log('Test 3: Scarce actions scenario (high effort actions)');
    const scarceScores = {
        pillars: [
            { 
                id: 'SECURITY', 
                name: 'Security', 
                score: 60,
                level: 'Established',
                actions: [
                    { text: 'Security audit', effort: 'high' },
                    { text: 'Penetration test', effort: 'high' }
                ]
            },
            { 
                id: 'GOVERNANCE', 
                name: 'Governance', 
                score: 45,
                level: 'Developing',
                actions: [
                    { text: 'Compliance review', effort: 'high' },
                    { text: 'Policy overhaul', effort: 'high' }
                ]
            },
            { 
                id: 'ITSM', 
                name: 'ITSM', 
                score: 40,
                level: 'Foundational',
                actions: [
                    { text: 'ITSM platform migration', effort: 'high' },
                    { text: 'Process redesign', effort: 'medium' }
                ]
            },
            { 
                id: 'CORE_IT_OPERATIONS', 
                name: 'Operations', 
                score: 50,
                level: 'Developing',
                actions: [
                    { text: 'Infrastructure overhaul', effort: 'high' },
                    { text: 'Automation setup', effort: 'medium' }
                ]
            }
        ]
    };

    const result3 = buildTimedActions(scarceScores);
    console.log(`✓ Immediate actions count: ${result3.immediate.length}`);
    console.log(`✓ Total effort: ${result3.metadata.effortUsed30}`);
    console.log(`✓ Overflow used: ${result3.metadata.overflowUsed}`);
    console.log(`✓ Overflow guard respected (≤ 1): ${result3.metadata.overflowUsed <= 1}`);
    console.log('Actions:', result3.immediate.map(a => `${a.text} (${a.reason}, effort: ${a.effort})`));
    console.log('');

    // Test 4: Reason tagging verification
    console.log('Test 4: Reason tagging verification');
    const reasons1 = [...new Set(result1.immediate.map(a => a.reason))];
    const reasons2 = [...new Set(result2.immediate.map(a => a.reason))];
    const reasons3 = [...new Set(result3.immediate.map(a => a.reason))];
    
    console.log(`✓ Low security reasons: ${reasons1.join(', ')}`);
    console.log(`✓ Balanced case reasons: ${reasons2.join(', ')}`);
    console.log(`✓ Scarce case reasons: ${reasons3.join(', ')}`);
    console.log(`✓ Has security_override in low security: ${reasons1.includes('security_override')}`);
    console.log(`✓ Has balanced_fill: ${reasons2.includes('balanced_fill') || reasons3.includes('balanced_fill')}`);
    
    const validReasons = ['security_override', 'balanced_fill', 'min_count_relax'];
    const allReasonsValid = [...result1.immediate, ...result2.immediate, ...result3.immediate]
        .every(a => validReasons.includes(a.reason));
    console.log(`✓ All reasons valid: ${allReasonsValid}`);

    // Test 5: Overflow budget test - force overflow usage
    console.log('Test 5: Overflow budget stress test');
    const overflowScores = {
        pillars: [
            { 
                id: 'SECURITY', 
                name: 'Security', 
                score: 30,  // Triggers security override
                level: 'Foundational',
                actions: [
                    { text: 'Critical security fix', effort: 'high' }  // 3 points
                ]
            },
            { 
                id: 'GOVERNANCE', 
                name: 'Governance', 
                score: 45,
                level: 'Developing',
                actions: [
                    { text: 'Governance action', effort: 'high' }  // 3 points
                ]
            },
            { 
                id: 'ITSM', 
                name: 'ITSM', 
                score: 40,
                level: 'Foundational',
                actions: [
                    { text: 'ITSM action', effort: 'medium' }  // 2 points (would total 8, exceed budget+overflow)
                ]
            }
        ]
    };

    const result5 = buildTimedActions(overflowScores);
    console.log(`✓ Immediate actions count: ${result5.immediate.length}`);
    console.log(`✓ Total effort: ${result5.metadata.effortUsed30}`);
    console.log(`✓ Overflow used: ${result5.metadata.overflowUsed}`);
    console.log(`✓ Security override applied: ${result5.metadata.securityOverrideApplied}`);
    console.log(`✓ Overflow within limit (≤ 1): ${result5.metadata.overflowUsed <= 1}`);
    console.log(`✓ Total effort ≤ 7 (6 + 1 overflow): ${result5.metadata.effortUsed30 <= 7}`);
    console.log('Actions:', result5.immediate.map(a => `${a.text} (${a.reason}, effort: ${a.effort})`));
    console.log('');

    console.log('🎉 All tests completed!');
    
    // Summary report
    console.log('\n📊 Test Summary:');
    console.log(`Test 1 (Low Security): ${result1.immediate.length} actions, ${result1.metadata.effortUsed30} effort, overflow: ${result1.metadata.overflowUsed}`);
    console.log(`Test 2 (Balanced): ${result2.immediate.length} actions, ${result2.metadata.effortUsed30} effort, overflow: ${result2.metadata.overflowUsed}`);
    console.log(`Test 3 (Scarce): ${result3.immediate.length} actions, ${result3.metadata.effortUsed30} effort, overflow: ${result3.metadata.overflowUsed}`);
    console.log(`Test 5 (Overflow): ${result5.immediate.length} actions, ${result5.metadata.effortUsed30} effort, overflow: ${result5.metadata.overflowUsed}`);
}

// Run the tests
runTests();