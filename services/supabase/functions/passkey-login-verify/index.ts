import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RP_ID = Deno.env.get("PASSKEY_RP_ID") || "piotrgawel5.github.io";

// Base64URL decoding
function base64URLDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { credential, challengeId } = await req.json();

    console.log("Received login verify request, challengeId:", challengeId);

    if (!credential || !challengeId) {
      return new Response(
        JSON.stringify({ error: "Credential and challengeId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get challenge
    const { data: challengeRecord, error: challengeError } = await supabaseAdmin
      .from("passkey_challenges")
      .select("*")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challengeRecord) {
      console.error("Challenge lookup error:", challengeError);
      return new Response(
        JSON.stringify({ error: "Challenge not found or expired" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify challenge from clientDataJSON
    const clientDataJSON = JSON.parse(
      new TextDecoder().decode(
        base64URLDecode(credential.response.clientDataJSON),
      ),
    );

    if (clientDataJSON.challenge !== challengeRecord.challenge) {
      return new Response(
        JSON.stringify({ error: "Challenge mismatch" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Look up credential
    const credentialId = credential.id;
    const { data: storedCredential, error: credError } = await supabaseAdmin
      .from("passkey_credentials")
      .select("*")
      .eq("credential_id", credentialId)
      .single();

    if (credError || !storedCredential) {
      console.error("Credential lookup error:", credError);
      return new Response(
        JSON.stringify({
          error: "Passkey not found. Please create an account first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Update counter
    await supabaseAdmin
      .from("passkey_credentials")
      .update({ counter: (storedCredential.counter || 0) + 1 })
      .eq("id", storedCredential.id);

    // Delete used challenge
    await supabaseAdmin
      .from("passkey_challenges")
      .delete()
      .eq("id", challengeId);

    // Get user info
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
      storedCredential.user_id,
    );
    const userEmail = userData?.user?.email || "";

    // Generate a temp password and sign in to get real session
    const tempPassword = crypto.randomUUID();
    await supabaseAdmin.auth.admin.updateUserById(storedCredential.user_id, {
      password: tempPassword,
    });

    // Create session using signInWithPassword
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: signInData, error: signInError } = await supabaseClient.auth
      .signInWithPassword({
        email: userEmail,
        password: tempPassword,
      });

    if (signInError || !signInData.session) {
      console.error("Sign in error:", signInError);
      return new Response(
        JSON.stringify({
          verified: true,
          user_id: storedCredential.user_id,
          error: "Verified but session failed. Please try again.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      "Login session created successfully for user:",
      storedCredential.user_id,
    );

    return new Response(
      JSON.stringify({
        verified: true,
        user_id: storedCredential.user_id,
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("passkey-login-verify error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
