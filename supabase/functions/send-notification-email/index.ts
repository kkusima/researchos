// Supabase Edge Function: Send Email Notifications via Resend
// Uses only native Deno APIs - no external imports needed

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

        // Fetch user details using native fetch
        const userResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${notification.user_id}&select=email,name,email_notifications`,
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

        // Skip if email_notifications is disabled
        if (!userData.email_notifications) {
            return new Response(JSON.stringify({ skipped: true, reason: "email_notifications disabled" }), {
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
