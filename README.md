# PeopleCore HRM — Complete Setup Guide

**Next.js 16 · TypeScript · PostgreSQL · Tailwind CSS v4 · face-api.js**

---

## Quick Start (5 steps)

### Step 1 — Extract & Install
```bash
# Extract the ZIP, open folder in VS Code, then in terminal:
npm install
```

### Step 2 — Create the database
```bash
# Windows (if psql is in PATH):
psql -U postgres -c "CREATE DATABASE peoplecore_hrm;"

# Or in DataGrip / pgAdmin:
# Right-click Databases → Create → Name: peoplecore_hrm → Save
```

### Step 3 — Configure environment
Rename `.env.example` to `.env.local` and edit these two lines:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/peoplecore_hrm
JWT_SECRET=any-long-random-string-minimum-32-characters-here
```
Replace `YOUR_PASSWORD` with your PostgreSQL password.

### Step 4 — Run database schema
```bash
# Creates all tables + sample data + default admin account
psql -U postgres -d peoplecore_hrm -f scripts/schema.sql
psql -U postgres -d peoplecore_hrm -f scripts/schema-v3.sql
```

### Step 5 — Start the app
```bash
npm run dev
```
Open **http://localhost:3000**

**Login:** `admin@peoplecore.com` / `Admin@1234`

---

## Troubleshooting

### "psql is not recognized"
Add PostgreSQL to PATH:
1. Search "Edit system environment variables" in Windows
2. Environment Variables → System Variables → Path → Edit → New
3. Add: `C:\Program Files\PostgreSQL\17\bin`
4. Close ALL terminals, reopen VS Code

Or use the full path:
```bash
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE peoplecore_hrm;"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d peoplecore_hrm -f scripts/schema.sql
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d peoplecore_hrm -f scripts/schema-v3.sql
```

### "Connection refused" / 401 errors
1. Check PostgreSQL is running: search "Services" in Windows → find postgresql → Start
2. Check `.env.local` has correct password
3. Test: `psql -U postgres -d peoplecore_hrm -c "SELECT email FROM admin_users;"`

### If admin login still fails, regenerate password hash
```bash
node -e "const b=require('bcryptjs');b.hash('Admin@1234',12).then(h=>console.log(h))"
# Copy the output hash, then in DataGrip run:
# UPDATE admin_users SET password_hash='PASTE_HASH' WHERE email='admin@peoplecore.com';
```

### CSS not loading
This project uses Tailwind CSS v4. The `globals.css` uses `@import "tailwindcss"` (NOT `@tailwind base`).
If styles look broken, check `app/globals.css` starts with exactly:
```css
@import "tailwindcss";
```

---

## Feature Map

| URL | Feature |
|-----|---------|
| `/dashboard` | Live KPIs, charts, quick actions |
| `/employees` | Employee CRUD, search, pagination |
| `/registration` | 3-step: details → face enrollment → done |
| `/induction` | 5-step wizard + checklist |
| `/attendance` | Daily log + heatmap |
| `/schedule` | Weekly roster grid |
| `/leave` | Apply / approve / deny |
| `/payroll` | Run payroll + ABA bank file |
| `/expenses` | Expense claims workflow |
| `/performance` | Reviews + KPI tracking |
| `/training` | Module library + completions |
| `/documents` | Document vault + expiry alerts |
| `/analytics` | Recharts workforce analytics |
| `/realtime` | Live attendance via SSE |
| `/ai` | HR chatbot + attrition AI + job generator |
| `/kiosk` | Facial recognition clock-in (with liveness) |
| `/facial` | Simulated facial login test |
| `/reports` | 6 report types + CSV export |
| `/users` | Admin users + RBAC roles |
| `/settings` | Company, SMTP, AI, storage config |

---

## Activate AI Features

Add your Anthropic API key to `.env.local`:
```env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Get a key at: https://console.anthropic.com

Features unlocked:
- **HR Chatbot** — Ask about policies, data, Fair Work Act
- **Attrition Prediction** — AI scores each employee's flight risk
- **Job Description Generator** — AI writes JDs instantly

Without the key, AI features fall back to rule-based logic gracefully.

---

## Activate Email Notifications

For development (no config needed):
- Emails are automatically sent to **Ethereal** (fake inbox)
- Check the terminal for a preview URL like: `Preview: https://ethereal.email/message/xxx`

For production, add to `.env.local`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=PeopleCore <noreply@yourcompany.com>
HR_ADMIN_EMAIL=hr@yourcompany.com
```
For Gmail: enable 2FA → My Account → Security → App Passwords → generate one.

---

## ABA Bank File (Payroll)

To generate ABA direct credit files, add to `.env.local`:
```env
COMPANY_BSB=062-000
COMPANY_ACCOUNT=12345678
COMPANY_BANK=CBA
APCA_ID=000001
```

Then go to **Payroll** → run payroll → click the download button on any run.

---

## Face Recognition Setup

### Download models (one-time, ~6MB):
```bash
node scripts/download-models.js
```

### Kiosk (attendance clock-in):
1. Register an employee via `/registration` — face enrollment happens automatically (step 2)
2. Open `/kiosk` on a dedicated tablet or screen
3. Employee stands in front, clicks **Start Verification**, blinks, then clicks **Start Work**

### Liveness detection:
The kiosk uses **blink detection** (Eye Aspect Ratio via face-api.js landmarks) to prevent photo spoofing. A real blink is required before face matching proceeds.

---

## Production Deployment

### Docker (recommended):
```bash
cp .env.example .env
# Edit .env with real values
docker compose up -d --build
```

### Vercel + Neon PostgreSQL:
1. Push to GitHub
2. Import at vercel.com/new
3. Create free DB at neon.tech
4. Add environment variables in Vercel dashboard
5. Deploy

### Manual VPS:
```bash
npm run build
npm start          # or use PM2:
pm2 start npm --name peoplecore -- start
```

---

## Tech Stack

- **Frontend**: Next.js 16 App Router, React 19, TypeScript
- **Styling**: Tailwind CSS v4, inline styles for critical layout
- **Database**: PostgreSQL 16 via node-postgres (pg)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Face Recognition**: face-api.js (TinyFaceDetector + FaceRecognitionNet)
- **Charts**: Recharts
- **AI**: Anthropic Claude (claude-sonnet-4-20250514)
- **Email**: Nodemailer (Ethereal dev, SMTP prod)
- **Storage**: Local disk (dev), AWS S3 / Cloudflare R2 (prod)
- **Deployment**: Docker + docker-compose, Vercel-ready
