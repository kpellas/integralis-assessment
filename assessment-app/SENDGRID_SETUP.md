# SendGrid Setup Guide - Quick Steps

## 1. Create SendGrid Account (5 minutes)

1. Go to: **https://signup.sendgrid.com/**
2. Fill in the form:
   - Email: Use your work email
   - Password: Create a strong password
   - First/Last Name: Your details
   - Company: Integralis
   - Country: Australia
3. Click "Create Account"
4. Check your email and **verify your account**

## 2. Complete Setup Wizard

After email verification, you'll be asked:
- **What's your goal?** → Select "Send transactional email"
- **How do you want to send email?** → Select "Using an API or SMTP Relay"
- **Skip** the code integration steps (we've already done this)

## 3. Verify Sender Identity (IMPORTANT!)

### Option A: Single Sender (Quickest - Recommended for Testing)
1. Go to **Settings → Sender Authentication**
2. Click **Verify a Single Sender**
3. Click **Create New Sender**
4. Fill in:
   - **From Name:** Integralis Assessment Team
   - **From Email:** Use an email you control (e.g., your work email)
   - **Reply To:** Same as From Email
   - **Company Address:** Your company address
   - **City:** Your city
   - **Country:** Australia
5. Click **Create**
6. **Check your email and click the verification link**

### Option B: Domain Authentication (Better for Production)
- This requires DNS access to your domain
- Takes longer but looks more professional
- Can be done later

## 4. Generate API Key

1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. API Key Name: `Integralis Assessment Tool`
4. API Key Permissions: Select **Full Access** (or Restricted with Mail Send)
5. Click **Create & View**
6. **COPY THE API KEY IMMEDIATELY!** (You won't see it again)
   ```
   It will look like: SG.xxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyy
   ```

## 5. Add to Local Environment

1. Open your `.env` file in the assessment-app folder
2. Update with your actual values:
   ```
   SENDGRID_API_KEY=SG.your_actual_api_key_here
   FROM_EMAIL=your_verified_email@company.com
   FROM_NAME=Integralis Assessment Team
   ```

## 6. Restart the Server

1. Stop the current server: Press `Ctrl+C` in terminal
2. Restart with environment variables:
   ```bash
   npx netlify dev --port 3000
   ```

## 7. Test Email Sending

1. Go to http://localhost:3000
2. Complete a test assessment
3. Click "Get Detailed PDF Report"
4. Enter your details (use a different email to receive)
5. Submit and check your inbox!

## Troubleshooting

### Email Not Arriving?
1. Check SendGrid Activity Feed:
   - Go to **Activity → Activity Feed** in SendGrid
   - Look for your email - check status
   - Common issues: Bounced, Blocked, or Invalid

2. Check Spam Folder
   - Especially for first-time sends

3. Verify API Key is Correct:
   - No extra spaces
   - Starts with `SG.`
   - Is in your `.env` file

### "Unauthorized" Error?
- API key is incorrect or not set
- Make sure `.env` file is in the right location
- Restart the server after changing `.env`

### "Bad Request" Error?
- Sender email not verified
- Go back to Step 3 and verify sender

## SendGrid Dashboard URLs

- Main Dashboard: https://app.sendgrid.com/
- API Keys: https://app.sendgrid.com/settings/api_keys
- Sender Verification: https://app.sendgrid.com/settings/sender_auth
- Activity Feed: https://app.sendgrid.com/activity

## Free Tier Limits
- 100 emails/day forever free
- Perfect for testing and small deployments
- Upgrade if you need more

---

## Ready to Deploy to Production?

Once email works locally, you'll add the same environment variables to Netlify:
1. Netlify Dashboard → Site Settings → Environment Variables
2. Add the same 3 variables (SENDGRID_API_KEY, FROM_EMAIL, FROM_NAME)
3. Deploy and test!