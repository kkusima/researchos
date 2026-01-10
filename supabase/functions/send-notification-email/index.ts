// Supabase Edge Function: Send Email Notifications via Resend
// Uses granular notification_settings for per-type email control

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Map notification types to their email setting column
const notificationTypeToEmailSetting: Record<string, string> = {
    // Reminders
    "task_reminder": "reminder_upcoming_email",
    "subtask_reminder": "reminder_upcoming_email",
    "task_reminder_set": "reminder_upcoming_email",
    "subtask_reminder_set": "reminder_upcoming_email",
    "task_overdue": "reminder_overdue_email",
    "subtask_overdue": "reminder_overdue_email",
    // Task Activity
    "task_created": "task_created_email",
    "task_updated": "task_updated_email",
    "task_deleted": "task_deleted_email",
    "subtask_created": "subtask_activity_email",
    "subtask_updated": "subtask_activity_email",
    "subtask_deleted": "subtask_activity_email",
    // Collaboration
    "project_shared": "project_shared_email",
    "project_invite": "project_shared_email",
    "project_removed": "project_removed_email",
    "comment_added": "comment_added_email",
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Missing environment variables" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        })
    }

    try {
        const payload = await req.json()

        // Only process INSERT events
        if (payload.type !== "INSERT") {
            return new Response(JSON.stringify({ skipped: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

        const notification = payload.record
        const notificationType = notification.type

        // Determine which email setting column to check
        const emailSettingColumn = notificationTypeToEmailSetting[notificationType]
        if (!emailSettingColumn) {
            console.log(`Unknown notification type: ${notificationType}, skipping email`)
            return new Response(JSON.stringify({ skipped: true, reason: `Unknown type: ${notificationType}` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

        // Fetch user and their notification settings
        const userResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${notification.user_id}&select=email,name`,
            {
                headers: {
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
            }
        )
        const users = await userResponse.json()
        const userData = users?.[0]

        if (!userData) {
            console.error("User not found")
            return new Response(JSON.stringify({ error: "User not found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            })
        }

        // Fetch notification settings for this user
        const settingsResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/notification_settings?user_id=eq.${notification.user_id}&select=${emailSettingColumn}`,
            {
                headers: {
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
            }
        )
        const settings = await settingsResponse.json()
        const userSettings = settings?.[0]

        // Check if email is enabled for this notification type
        // Default to false (email OFF) if no settings exist
        const emailEnabled = userSettings?.[emailSettingColumn] ?? false

        if (!emailEnabled) {
            return new Response(JSON.stringify({ skipped: true, reason: `${emailSettingColumn} is disabled` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

        // Build email content
        const emailSubject = `HypotheSys - ${notification.title}`
        const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1f2937; font-size: 24px;">HypotheSys</h1>
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
          <h2 style="color: #374151; font-size: 18px; margin: 0 0 8px 0;">${notification.title}</h2>
          <p style="color: #6b7280; font-size: 14px;">${notification.message || ""}</p>
          <a href="https://hypothesys.vercel.app" style="display: inline-block; background: #1f2937; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Open HypotheSys</a>
        </div>
      </div>
    `

        // Send email via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "HypotheSys <notifications@hypothesys.dev>",
                to: [userData.email],
                subject: emailSubject,
                html: emailBody,
            }),
        })

        const resendData = await resendResponse.json()

        if (!resendResponse.ok) {
            console.error("Resend API error:", resendData)
            return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            })
        }

        return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error("Edge function error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        })
    }
})

