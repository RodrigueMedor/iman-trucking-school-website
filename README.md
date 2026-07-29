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

## Production

```bash
npm run build
```
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
