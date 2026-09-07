# Iman Trucking School website

Premium React and Material UI redesign of the owner-authorized website at
`imantruckingschool.com`. The application provides a modern responsive shell
while retaining the full original page content and routes in an isolated legacy
content layer.

## Development

```bash
npm install
npm run dev
```

## Production — Hostinger

### Option 1: Static Hosting (public_html)

```bash
npm run build
```

Upload the contents of `dist/` to Hostinger's `public_html/` directory. The
build includes `.htaccess` for React routes and
`api/send-assessment-report.php` for emailing student assessment attachments.

**Before building for production**, create a `.env.production` file with:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
```

These Supabase credentials are required for CDL login and authentication. They
will be baked into the production build, so ensure you use the publishable
(anon) key, not the service role key.

Configure these as server-side environment variables in Hostinger (never as
`VITE_` variables):

- `RESEND_API_KEY`: Resend API key used by the PHP email endpoint
- `RESULT_EMAIL_FROM`: optional verified sender, for example
  `Iman Trucking School <results@imanlogistics.com>`

The Hostinger PHP installation must have the cURL extension enabled. Student
report downloads do not require email configuration.

### Option 2: Node.js Deployment

For Hostinger Node.js hosting:

**IMPORTANT:** In Hostinger's Node.js deployment panel, set these environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable (anon) key
- `PORT`: (optional) defaults to 3000

**Build command:** `npm run build`

**Start command:** `npm start`

The custom `server.js` injects the Supabase credentials at runtime from the environment variables, so they don't need to be baked into the build. Just set the env vars in Hostinger and restart the application.
# Iman Trucking School website

## AI admissions chat

The floating **Ask Iman** assistant uses a Netlify Function so the OpenAI key and
GoHighLevel webhook are never exposed in browser code.

Set these environment variables in Netlify under **Site configuration →
Environment variables**, then redeploy:

- `OPENAI_API_KEY`: an OpenAI project API key
- `OPENAI_MODEL`: optional; defaults to `gpt-5.6-luna`
- `GHL_WEBHOOK_URL`: a GoHighLevel inbound-workflow webhook URL

The GoHighLevel workflow should accept `name`, `phone`, `email`, `question`,
`source`, `sessionId`, and `submittedAt`. Use those values to create/update the
contact, add the conversation note, assign the lead, and notify admissions.

Do not put either secret in a `VITE_` environment variable—those values are
included in public browser bundles.
