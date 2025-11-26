// Assessment Application Logic

// Generate unique session ID
function generateSessionId() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get or initialize daily counter
    const counterKey = `submission-counter-${today}`;
    let counter = parseInt(localStorage.getItem(counterKey) || '0');
    counter++;
    localStorage.setItem(counterKey, counter.toString());
    
    return `sub-${today}-${counter}`;
}

// State management
const state = {
    currentQuestion: 0,
    answers: {},
    questions: [],
    pillars: {},
    levelDescriptors: {},
    scores: null,
    contactInfo: {},
    tracking: {
        sessionId: generateSessionId(),
        referrer: document.referrer || 'Direct',
        landingTime: new Date().toISOString(),
        urlParams: Object.fromEntries(new URLSearchParams(window.location.search)),
        userAgent: navigator.userAgent
    }
};

// localStorage persistence functions
function saveProgress() {
    try {
        const progress = {
            currentQuestion: state.currentQuestion,
            answers: state.answers,
            contactInfo: state.contactInfo,
            timestamp: Date.now()
        };
        localStorage.setItem('assessmentProgress', JSON.stringify(progress));
    } catch (err) {
        console.log('Could not save progress to localStorage:', err);
    }
}

function loadProgress() {
    try {
        const saved = localStorage.getItem('assessmentProgress');
        if (saved) {
            const progress = JSON.parse(saved);
            // Only restore if saved within last 7 days
            if (Date.now() - progress.timestamp < 7 * 24 * 60 * 60 * 1000) {
                state.currentQuestion = progress.currentQuestion || 0;
                state.answers = progress.answers || {};
                state.contactInfo = progress.contactInfo || {};
                console.log('✅ Progress restored from localStorage');
                return true;
            }
        }
    } catch (err) {
        console.log('Could not load progress from localStorage:', err);
    }
    return false;
}

function clearProgress() {
    try {
        localStorage.removeItem('assessmentProgress');
    } catch (err) {
        console.log('Could not clear progress from localStorage:', err);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    loadProgress(); // Restore previous progress if available
    setupEventListeners();
});

// Load data from config files
async function loadData() {
    try {
        // Load questions, pillars, level descriptors, and pillar narratives
        const [questionsResponse, pillarsResponse, descriptorsResponse, narrativesResponse] = await Promise.all([
            fetch('/config/questions.json'),
            fetch('/config/pillars.json'),
            fetch('/config/level-descriptors.json'),
            fetch('/config/pillar_narratives.json')
        ]);
        
        // Check responses
        if (!questionsResponse.ok) {
            throw new Error(`Failed to load questions: ${questionsResponse.status}`);
        }
        if (!pillarsResponse.ok) {
            throw new Error(`Failed to load pillars: ${pillarsResponse.status}`);
        }
        if (!descriptorsResponse.ok) {
            throw new Error(`Failed to load descriptors: ${descriptorsResponse.status}`);
        }
        if (!narrativesResponse.ok) {
            throw new Error(`Failed to load narratives: ${narrativesResponse.status}`);
        }
        
        // Parse JSON
        const questionsData = await questionsResponse.json();
        const pillarsData = await pillarsResponse.json();
        const descriptorsData = await descriptorsResponse.json();
        const narrativesData = await narrativesResponse.json();
        
        // Runtime sanity check: Validate question-pillar mapping consistency
        console.log('🔍 Validating configuration consistency...');
        Object.values(pillarsData).forEach(pillar => {
            pillar.question_ids.forEach(qId => {
                const question = questionsData[qId];
                if (!question) {
                    throw new Error(`Config error: question ${qId} listed in pillar ${pillar.id} but not found in questions.json`);
                }
                if (question.pillar_id !== pillar.id) {
                    throw new Error(`Config mismatch: question ${qId} mapped to pillar ${question.pillar_id} in questions.json but listed under ${pillar.id} in pillars.json`);
                }
            });
        });
        
        // Validate level descriptors completeness (questions 1-35, levels 0-5)
        console.log('🔍 Validating level descriptors completeness...');
        for (let qId = 1; qId <= 35; qId++) {
            const descriptor = descriptorsData[qId];
            if (!descriptor) {
                throw new Error(`Config error: Missing level descriptors for question ${qId}`);
            }
            if (!descriptor.levels) {
                throw new Error(`Config error: Question ${qId} descriptor missing 'levels' object`);
            }
            for (let level = 0; level <= 5; level++) {
                if (!descriptor.levels[level]) {
                    throw new Error(`Config error: Question ${qId} missing level ${level} descriptor`);
                }
            }
        }
        console.log('✅ Level descriptors validation passed (35 questions, 6 levels each)');
        console.log('✅ Configuration validation completed successfully');
        
        // Store pillars, descriptors, and narratives for reference
        state.pillars = pillarsData;
        state.levelDescriptors = descriptorsData;
        state.pillarNarratives = narrativesData;
        
        // Convert questions object to array and add pillar names
        state.questions = Object.values(questionsData).map(q => ({
            id: q.id,
            pillar_id: q.pillar_id,
            pillar: pillarsData[q.pillar_id].name,
            text: q.full_prompt,
            short_label: q.short_label,
            strength_text: q.strength_text,
            gap_text: q.gap_text,
            weight: q.weight
        }));
        
        // Sort questions by ID to ensure correct order
        state.questions.sort((a, b) => a.id - b.id);
        
        renderQuestions();
    } catch (error) {
        console.error('Error loading assessment data:', error);
        alert('Failed to load assessment questions. Please refresh the page.');
    }
}

// Render all questions in the DOM (hidden initially)
function renderQuestions() {
    const container = document.getElementById('question-container');
    container.innerHTML = '';

    state.questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';
        questionDiv.id = `question-${index}`;
        if (index === 0) questionDiv.classList.add('active');

        questionDiv.innerHTML = `
            <span class="pillar-label">${q.pillar}</span>
            <h3>Question ${index + 1} of ${state.questions.length}</h3>
            <h4>${q.short_label}</h4>
            <p class="question-text">${q.text}</p>
            <div class="answer-options">
                ${renderAnswerOptions(q.id)}
            </div>
        `;

        container.appendChild(questionDiv);
    });

    updateProgress();
    updateTotalQuestions();
}

// Render answer options for a question
function renderAnswerOptions(questionId) {
    // Get question-specific descriptions if available
    const descriptors = state.levelDescriptors[questionId];
    
    if (descriptors && descriptors.levels) {
        // Use detailed question-specific descriptions
        const levelMap = {
            '0': { value: 0, label: 'Not in place' },
            '1': { value: 20, label: 'Ad hoc' },
            '2': { value: 40, label: 'Partially implemented' },
            '3': { value: 60, label: 'Defined but inconsistently applied' },
            '4': { value: 80, label: 'Consistently applied' },
            '5': { value: 100, label: 'Mature / Optimised' }
        };
        
        return Object.entries(descriptors.levels).map(([level, description]) => {
            const levelInfo = levelMap[level];
            const [label, desc] = description.split(' — ');
            
            return `
                <label class="answer-option" data-question="${questionId}" data-value="${levelInfo.value}">
                    <input type="radio" name="q${questionId}" value="${levelInfo.value}" ${state.answers[questionId] === levelInfo.value ? 'checked' : ''}>
                    <div class="answer-label">
                        <strong>${label}</strong>
                        <small>${desc}</small>
                    </div>
                </label>
            `;
        }).join('');
    } else {
        // Fallback to generic scale
        const scale = [
            { value: 0, label: 'Not in place', description: 'No capability or process exists' },
            { value: 20, label: 'Ad hoc', description: 'Informal, reactive approach' },
            { value: 40, label: 'Partially implemented', description: 'Some structure, but inconsistent' },
            { value: 60, label: 'Defined but inconsistently applied', description: 'Documented but not consistently followed' },
            { value: 80, label: 'Consistently applied', description: 'Reliably followed across teams' },
            { value: 100, label: 'Mature / Optimised', description: 'Continuous improvement embedded' }
        ];
        
        return scale.map((option) => `
            <label class="answer-option" data-question="${questionId}" data-value="${option.value}">
                <input type="radio" name="q${questionId}" value="${option.value}" ${state.answers[questionId] === option.value ? 'checked' : ''}>
                <div class="answer-label">
                    <strong>${option.label}</strong>
                    <small>${option.description}</small>
                </div>
            </label>
        `).join('');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
        showPage('assessment-page');
    });

    // Answer selection
    document.getElementById('question-container').addEventListener('click', (e) => {
        const option = e.target.closest('.answer-option');
        if (option) {
            const questionId = parseInt(option.dataset.question);
            const value = parseInt(option.dataset.value);
            
            // Update state
            state.answers[questionId] = value;
            
            // Save progress
            saveProgress();
            
            // Update UI
            const allOptions = document.querySelectorAll(`[data-question="${questionId}"]`);
            allOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            // Enable next button
            document.getElementById('next-btn').disabled = false;
        }
    });

    // Navigation buttons
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (state.currentQuestion > 0) {
            state.currentQuestion--;
            showQuestion(state.currentQuestion);
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        if (!state.answers.hasOwnProperty(state.questions[state.currentQuestion].id)) {
            alert('Please select an answer before continuing.');
            return;
        }

        if (state.currentQuestion < state.questions.length - 1) {
            state.currentQuestion++;
            saveProgress(); // Save navigation progress
            showQuestion(state.currentQuestion);
        } else {
            // Assessment complete, calculate scores and show summary
            calculateScores();
            clearProgress(); // Clear progress on completion
            showSummary();
        }
    });

    // Email Report button  
    document.getElementById('email-report-btn').addEventListener('click', () => {
        showPage('contact-page');
    });

    // Book Review button
    document.getElementById('book-review-btn').addEventListener('click', () => {
        showPage('callback-page');
    });

    // Book Review from confirmation page
    const bookReviewConfirmBtn = document.getElementById('book-review-confirm-btn');
    if (bookReviewConfirmBtn) {
        bookReviewConfirmBtn.addEventListener('click', () => {
            showPage('callback-page');
        });
    }

    // Callback form submission
    document.getElementById('callback-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('callback-name').value.trim();
        const email = document.getElementById('callback-email').value.trim();
        const organisation = document.getElementById('callback-organisation').value.trim();
        const phone = document.getElementById('callback-phone').value.trim();
        const preferredTime = document.getElementById('callback-preferred-time').value;
        const notes = document.getElementById('callback-notes').value.trim();

        if (!name || !email || !organisation || !phone) {
            alert('Please fill in all required fields.');
            return;
        }

        try {
            await submitCallbackRequest({
                name, email, organisation, phone, preferredTime, notes,
                sessionId: state.tracking.sessionId,
                scores: state.scores,
                answers: state.answers
            });
            showPage('callback-confirmation-page');
        } catch (error) {
            console.error('Error submitting callback request:', error);
            alert('There was an error submitting your request. Please try again.');
        }
    });

    // Back buttons for callback form
    document.getElementById('back-to-summary-callback').addEventListener('click', () => {
        showPage('summary-page');
    });

    document.getElementById('back-to-summary-callback-confirm').addEventListener('click', () => {
        showPage('summary-page');
    });

    // Email report from callback confirmation
    document.getElementById('email-report-from-callback').addEventListener('click', () => {
        showPage('contact-page');
    });

    // Optional industry "Other" toggle
    const industrySelect = document.getElementById('industry');
    const industryOtherGroup = document.getElementById('industry-other-group');
    if (industrySelect && industryOtherGroup) {
        industrySelect.addEventListener('change', () => {
            industryOtherGroup.style.display = industrySelect.value === 'Other' ? 'block' : 'none';
        });
    }

    // Back to Summary buttons
    document.getElementById('back-to-summary').addEventListener('click', () => {
        showPage('summary-page');
    });

    const backToSummaryConfirm = document.getElementById('back-to-summary-confirm');
    if (backToSummaryConfirm) {
        backToSummaryConfirm.addEventListener('click', () => {
            showPage('summary-page');
        });
    }

    // Contact form submission
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const organisation = document.getElementById('organisation-name').value.trim();
        const phone = (document.getElementById('contact-phone')?.value || '').trim();
        const orgSize = document.getElementById('org-size')?.value || '';
        const industry = document.getElementById('industry')?.value || '';
        const industryOther = (document.getElementById('industry-other')?.value || '').trim();

        // Validate corporate email (basic check for domain)
        const emailDomain = email.split('@')[1];
        if (!emailDomain || emailDomain.includes('gmail.com') || emailDomain.includes('hotmail.com') || 
            emailDomain.includes('yahoo.com') || emailDomain.includes('outlook.com')) {
            alert('Please use your corporate email address for the assessment report.');
            return;
        }

        // Store contact info (optional fields included)
        state.contactInfo = { name, email, organisation, phone, orgSize, industry, industryOther };
        saveProgress();

        // Submit assessment for detailed report
        await submitAssessment();
    });
}

// Calculate scores locally
function calculateScores() {
    // Calculate scores for each pillar
    const pillarScores = {};
    
    Object.values(state.pillars).forEach(pillar => {
        const pillarQuestions = state.questions.filter(q => q.pillar_id === pillar.id);
        
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        pillarQuestions.forEach(question => {
            const answerValue = state.answers[question.id] || 0;
            totalWeightedScore += answerValue * question.weight;
            totalWeight += question.weight;
        });
        
        const score = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
        const level = determineLevel(score);
        
        pillarScores[pillar.id] = {
            name: pillar.name,
            score: score,
            level: level
        };
    });
    
    // Calculate overall score
    const scores = Object.values(pillarScores);
    const overallScore = Math.round(
        scores.reduce((sum, p) => sum + p.score, 0) / scores.length
    );
    const overallLevel = determineLevel(overallScore);
    
    state.scores = {
        overall: overallScore,
        overallLevel: overallLevel,
        pillars: pillarScores
    };
}

// Determine maturity level from score (aligned with backend logic)
function determineLevel(score) {
    if (score <= 30) return 'Foundational';
    if (score <= 50) return 'Developing';
    if (score <= 70) return 'Established';
    if (score <= 90) return 'Advanced';
    return 'Optimised';
}

// Capture assessment results automatically for BCC
async function captureAssessmentResults() {
    try {
        const response = await fetch('/.netlify/functions/captureAssessment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answers: state.answers,
                tracking: {
                    ...state.tracking,
                    completionTime: new Date().toISOString()
                }
            })
        });
        
        if (!response.ok) {
            console.log('Assessment capture failed (non-blocking):', response.status);
        }
    } catch (error) {
        console.log('Assessment capture error (non-blocking):', error);
    }
}

// Show summary page with basic results
function showSummary() {
    // Automatically capture results for BCC (non-blocking)
    captureAssessmentResults();
    
    const summaryDiv = document.getElementById('summary-results');
    
    summaryDiv.innerHTML = `
        <div class="overall-score">
            <h3>Overall Assessment</h3>
            <div>
                <span class="score-value">${state.scores.overall}%</span>
                <span class="score-label">(${state.scores.overallLevel})</span>
            </div>
        </div>
        
        <h3 style="margin-bottom: 0.8rem; font-size: 1.1rem;">Capability Scores by Pillar</h3>
        <div class="pillar-scores">
            ${Object.values(state.scores.pillars).map(pillar => {
                // Get the narrative for this pillar and level
                const pillarKey = Object.keys(state.pillars).find(key => state.pillars[key].name === pillar.name);
                let narrative = '';
                
                // PRIORITIZE pillar_narratives.json (2-sentence format) over pillars.json
                if (state.pillarNarratives && state.pillarNarratives[pillarKey]) {
                    const levelMap = {
                        'Foundational': 'Foundational',
                        'Developing': 'Developing', 
                        'Established': 'Established',
                        'Advanced': 'Advanced',
                        'Optimised': 'Optimised'
                    };
                    const mappedLevel = levelMap[pillar.level] || pillar.level;
                    narrative = state.pillarNarratives[pillarKey][mappedLevel] || '';
                }
                
                // Fallback to pillars.json only if no narrative found
                if (!narrative && state.pillars[pillarKey] && state.pillars[pillarKey].narratives) {
                    narrative = state.pillars[pillarKey].narratives[pillar.level];
                }
                
                return `
                <div class="pillar-score-item">
                    <div class="pillar-header">
                        <div class="pillar-name">${pillar.name}</div>
                        <div class="pillar-level-badge">${pillar.level}</div>
                    </div>
                    <div class="pillar-bar">
                        <div class="pillar-fill" style="width: ${pillar.score}%"></div>
                    </div>
                    <div class="pillar-value">${pillar.score}%</div>
                    ${narrative ? `<div class="pillar-narrative">${narrative}</div>` : ''}
                </div>
                `;
            }).join('')}
        </div>
        
        <div class="summary-insight">
            <p><strong>What this means:</strong> Your organisation shows ${getInsightText(state.scores.overall)} across IT and cyber capabilities.</p>
        </div>
    `;
    
    showPage('summary-page');
}

// Get insight text based on overall score
function getInsightText(score) {
    if (score <= 30) {
        return 'foundational maturity with significant opportunities for improvement';
    } else if (score <= 50) {
        return 'developing maturity with key areas requiring structured improvement';
    } else if (score <= 70) {
        return 'established maturity with opportunities for optimisation and automation';
    } else if (score <= 90) {
        return 'advanced maturity with focus on continuous improvement and innovation';
    } else {
        return 'optimised maturity with excellence in operational delivery and strategic capability';
    }
}

// Show specific page
function showPage(pageId) {
    const pages = ['landing-page', 'assessment-page', 'summary-page', 'contact-page', 'confirmation-page', 'callback-page', 'callback-confirmation-page'];
    pages.forEach(page => {
        const element = document.getElementById(page);
        if (element) {
            element.style.display = page === pageId ? 'block' : 'none';
        }
    });
}

// Show specific question
function showQuestion(index) {
    const questions = document.querySelectorAll('.question');
    questions.forEach((q, i) => {
        q.classList.toggle('active', i === index);
    });

    // Update navigation buttons
    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').disabled = !state.answers.hasOwnProperty(state.questions[index].id);
    
    // Update button text
    const nextBtn = document.getElementById('next-btn');
    nextBtn.textContent = index === state.questions.length - 1 ? 'Complete Assessment' : 'Next';

    updateProgress();
}

// Update progress bar
function updateProgress() {
    const progress = ((state.currentQuestion + 1) / state.questions.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('current-question').textContent = state.currentQuestion + 1;
}

// Update total questions display
function updateTotalQuestions() {
    document.getElementById('total-questions').textContent = state.questions.length;
}

// Submit assessment to backend for detailed report
async function submitAssessment() {
    // Show loading overlay
    document.getElementById('loading-overlay').style.display = 'flex';

    try {
        const payload = {
            organisation: state.contactInfo.organisation,
            contactName: state.contactInfo.name,
            contactEmail: state.contactInfo.email,
            contactPhone: state.contactInfo.phone || '',
            orgSize: state.contactInfo.orgSize || '',
            industry: state.contactInfo.industry || '',
            industryOther: state.contactInfo.industryOther || '',
            answers: state.answers,
            tracking: {
                ...state.tracking,
                completionTime: new Date().toISOString()
            },
            submittedAt: new Date().toISOString()
        };

        // Auto-detect API endpoint based on environment
        const apiEndpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? '/.netlify/functions/generateReport'  // Netlify dev
            : '/api/generateReport';  // Production/Docker

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        // Hide loading overlay
        document.getElementById('loading-overlay').style.display = 'none';

        // Show confirmation page
        showPage('confirmation-page');

    } catch (error) {
        console.error('Error submitting assessment:', error);
        document.getElementById('loading-overlay').style.display = 'none';
        
        // Show more detailed error information
        let errorMessage = 'There was an error sending your report.';
        if (error.message) {
            errorMessage += ` Details: ${error.message}`;
        }
        errorMessage += '\n\nPlease contact assessment@integralis.com.au for assistance.';
        
        alert(errorMessage);
        showPage('summary-page');
    }
}

// Submit callback request
async function submitCallbackRequest(data) {
    try {
        const response = await fetch('/.netlify/functions/submitCallback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...data,
                tracking: {
                    ...state.tracking,
                    requestTime: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Callback request submitted successfully:', result);
        
    } catch (error) {
        console.error('Error submitting callback request:', error);
        throw error;
    }
}