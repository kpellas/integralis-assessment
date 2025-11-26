# Quick Start Guide - Integralis Assessment Tool

## Local Testing
```bash
# Install dependencies
npm install

# Run locally
npx netlify dev --port 3000

# Access at http://localhost:3000
```

## SendGrid Setup (Required for Email/PDF)

### 1. Sign Up
- Go to https://signup.sendgrid.com/
- Create free account (100 emails/day free)

### 2. Verify Sender
- Settings > Sender Authentication > Single Sender Verification
- Add email: `assessments@yourdomain.com.au`
- Click verification link in email

### 3. Get API Key
- Settings > API Keys > Create API Key
- Name: `Integralis Assessment`
- Permissions: Mail Send
- **COPY KEY IMMEDIATELY** (shown only once)

## Deploy to Netlify

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin [your-github-repo-url]
git push -u origin main
```

### 2. Deploy
1. Go to https://app.netlify.com
2. **Add new site > Import existing project > GitHub**
3. Select your repository
4. **IMPORTANT**: Add environment variables before deploying:
   - `SENDGRID_API_KEY` = [your key from above]
   - `FROM_EMAIL` = assessments@yourdomain.com.au
   - `FROM_NAME` = Integralis Assessment Team
5. Click **Deploy site**

### 3. Test
- Visit your site: `https://[site-name].netlify.app`
- Complete assessment with your email
- Check inbox for PDF report

## File Structure
```
assessment-app/
├── public/           # Frontend files
│   ├── index.html   # Main HTML
│   ├── styles.css   # Styles
│   └── app.js       # Frontend logic
├── src/config/      # Content files
│   ├── questions.json       # 35 questions
│   ├── pillars.json        # 5 capability pillars
│   ├── framework_guidance.json  # E8/SMB1001/ISO guidance
│   └── overall_level_narratives.json
├── netlify/functions/
│   └── generateReport.js  # Backend (PDF + Email)
└── netlify.toml     # Netlify config
```

## Update Content
Edit JSON files in `src/config/`, then:
```bash
git add .
git commit -m "Update assessment content"
git push
```
Netlify auto-deploys changes.

## Troubleshooting

### Emails Not Sending?
1. Check Netlify Functions logs
2. Verify SendGrid API key
3. Confirm sender email is verified
4. Check SendGrid dashboard for blocks

### PDF Not Generating?
- Check browser console for errors
- Verify all JSON files are valid
- Check function logs in Netlify dashboard

### Local Testing Issues?
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npx netlify dev --port 3000
```

## Key Features
- ✅ 35 questions across 5 pillars
- ✅ Deterministic scoring (0-100 scale)
- ✅ Professional PDF reports
- ✅ Framework recommendations (E8, SMB1001, ISO 27001)
- ✅ Prioritised action plans
- ✅ Australian spelling throughout
- ✅ Corporate email validation
- ✅ No AI in report generation (all content from JSON)

## Support
- Netlify Status: https://www.netlifystatus.com/
- SendGrid Status: https://status.sendgrid.com/
- Contact: assessments@integralis.com.au