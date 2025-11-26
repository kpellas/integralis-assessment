# Integralis IT Capability Assessment - Deployment Guide

## Overview
This guide will walk you through deploying the Integralis IT Capability Assessment tool to Netlify with SendGrid email integration.

## Prerequisites
- GitHub account (for connecting to Netlify)
- Netlify account (free tier is sufficient)
- SendGrid account via Twilio (for email delivery)

## Step 1: SendGrid Setup

### 1.1 Create SendGrid Account
1. Go to https://signup.sendgrid.com/
2. Sign up for a free account (100 emails/day limit on free tier)
3. Complete email verification

### 1.2 Verify Sender Identity
1. In SendGrid dashboard, go to **Settings > Sender Authentication**
2. Choose **Single Sender Verification** (easier for getting started)
3. Add sender details:
   - From Email: `assessments@yourdomain.com.au`
   - From Name: `Integralis Assessment Team`
   - Reply To: `assessments@integralis.com.au`
4. Check your email and click the verification link

### 1.3 Generate API Key
1. Go to **Settings > API Keys**
2. Click **Create API Key**
3. Name it: `Integralis Assessment Tool`
4. Select **Full Access** or **Restricted Access** with Mail Send permissions
5. Copy the API key immediately (you won't see it again)

## Step 2: Prepare for Deployment

### 2.1 Push Code to GitHub
```bash
# Initialise git repository if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Integralis IT Assessment Tool"

# Create repository on GitHub and push
git remote add origin https://github.com/yourusername/integralis-assessment.git
git branch -M main
git push -u origin main
```

### 2.2 Environment Variables
You'll need these environment variables in Netlify:
- `SENDGRID_API_KEY`: Your SendGrid API key from Step 1.3
- `FROM_EMAIL`: Your verified sender email (e.g., `assessments@yourdomain.com.au`)
- `FROM_NAME`: Sender name (e.g., `Integralis Assessment Team`)

## Step 3: Deploy to Netlify

### 3.1 Connect to Netlify
1. Go to https://app.netlify.com
2. Click **Add new site > Import an existing project**
3. Choose **GitHub** as your Git provider
4. Authorise Netlify to access your GitHub account
5. Select the repository containing your assessment tool

### 3.2 Configure Build Settings
Netlify should auto-detect the settings, but verify:
- **Build command**: `npm run build` (or leave empty for this static site)
- **Publish directory**: `public`
- **Functions directory**: `netlify/functions`

### 3.3 Set Environment Variables
1. Before deploying, click **Show advanced**
2. Click **New variable** and add:
   - Key: `SENDGRID_API_KEY`, Value: `[your SendGrid API key]`
   - Key: `FROM_EMAIL`, Value: `assessments@yourdomain.com.au`
   - Key: `FROM_NAME`, Value: `Integralis Assessment Team`

### 3.4 Deploy Site
1. Click **Deploy site**
2. Wait for deployment to complete (usually 1-2 minutes)
3. Your site will be available at `https://[your-site-name].netlify.app`

## Step 4: Configure Custom Domain (Optional)

### 4.1 Add Custom Domain
1. In Netlify, go to **Site settings > Domain management**
2. Click **Add custom domain**
3. Enter your domain (e.g., `assessments.integralis.com.au`)
4. Follow the DNS configuration instructions

### 4.2 Enable HTTPS
1. Netlify automatically provisions SSL certificates
2. Wait for DNS propagation (can take up to 24 hours)
3. Force HTTPS in **Site settings > Domain management > HTTPS**

## Step 5: Test the Deployment

### 5.1 Test the Assessment Flow
1. Navigate to your deployed site
2. Complete a test assessment with sample answers
3. Use a valid email address you can access
4. Submit the assessment
5. Check your email for the PDF report

### 5.2 Troubleshooting
If emails aren't sending:
1. Check Netlify Functions logs: **Functions > generateReport > View logs**
2. Verify SendGrid API key is correct
3. Ensure sender email is verified in SendGrid
4. Check SendGrid activity feed for bounce/block reasons

## Step 6: Production Checklist

Before going live:
- [ ] Test with multiple email domains
- [ ] Verify PDF generation works correctly
- [ ] Check all 35 questions display properly
- [ ] Ensure scoring calculations are accurate
- [ ] Test on mobile devices
- [ ] Configure custom domain
- [ ] Set up email forwarding for assessments@integralis.com.au
- [ ] Monitor SendGrid quota usage

## Maintenance

### Update Content
To update questions or scoring:
1. Edit JSON files in `src/config/`
2. Commit and push to GitHub
3. Netlify will auto-deploy changes

### Monitor Usage
- Check Netlify dashboard for function invocations
- Monitor SendGrid for email delivery stats
- Review function logs for any errors

### Backup Responses
Consider setting up:
- Webhook to save submissions to a database
- Google Sheets integration for response tracking
- Regular export of Netlify function logs

## Support

For issues or questions:
- Netlify docs: https://docs.netlify.com
- SendGrid docs: https://docs.sendgrid.com
- Contact: assessments@integralis.com.au

## Security Notes

- Never commit `.env` files with API keys
- Rotate SendGrid API key periodically
- Use environment variables for all sensitive data
- Enable 2FA on Netlify and SendGrid accounts
- Regularly review function logs for suspicious activity