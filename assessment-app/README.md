# Integralis Assessment - Maintenance Guide

## Configuration Files

All assessment content is controlled by JSON files in `src/config/`:

### Required Files (replace placeholders with your actual content):

1. **pillars.json** - Capability pillar definitions
2. **questions.json** - All 35 assessment questions
3. **overall_level_narratives.json** - Maturity level descriptions
4. **framework_guidance.json** - Framework recommendation logic

## Making Changes

### To Update Questions:
Edit `src/config/questions.json`

### To Change Scoring Thresholds:
Edit `netlify/functions/generateReport.js` - see `determineMaturityLevel()` function

### To Modify Email Content:
Edit `netlify/functions/generateReport.js` - see `sendEmail()` function

### To Change PDF Styling:
Edit `netlify/functions/generateReport.js` - see `generateReportHtml()` function

## Environment Variables (Netlify Dashboard)

Required:
- `SENDGRID_API_KEY` - Your SendGrid API key
- `FROM_EMAIL` - Sender email (e.g., assessments@integralis.com.au)
- `FROM_NAME` - Sender name (e.g., "Integralis Assessment Team")

## Troubleshooting

### Email Not Sending:
1. Check SendGrid API key is valid
2. Verify sender email is authenticated in SendGrid
3. Check function logs in Netlify dashboard

### PDF Not Generating:
1. Check function logs for errors
2. Verify all config JSON files are valid
3. Ensure Puppeteer has sufficient memory (check function size limits)

### Questions Not Displaying:
1. Verify `questions.json` is valid JSON
2. Check browser console for errors
3. Ensure file is accessible at `/config/questions.json`

## Deployment

Push to GitHub and Netlify auto-deploys. No manual steps needed.

## Support

For technical issues, check:
- Netlify function logs
- Browser console errors
- SendGrid activity feed
