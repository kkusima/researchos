# Supabase Edge Function Setup

This Edge Function sends email notifications via Resend when new notifications are created.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Logged into Supabase: `supabase login`
3. Linked to your project: `supabase link --project-ref <your-project-ref>`

## Deployment

1. Set the Resend API key as a secret:
   ```bash
   supabase secrets set RESEND_API_KEY=your_resend_api_key_here
   ```

2. Deploy the function:
   ```bash
   supabase functions deploy send-notification-email
   ```

3. Create a Database Webhook in Supabase Dashboard:
   - Go to Database → Webhooks
   - Create new webhook:
     - Name: `send-notification-email-trigger`
     - Table: `notifications`
     - Events: `INSERT`
     - Type: `Supabase Edge Function`
     - Function: `send-notification-email`

## Important Notes

- The `from` email domain must be verified in Resend
- For production, update the `from` address to use a verified domain
- Users can toggle `email_notifications` in Account Settings to opt-out
