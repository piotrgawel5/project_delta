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
    const { email, credential } = await req.json();

    console.log("Received registration verify request for:", email);

    if (!email || !credential) {
      return new Response(
        JSON.stringify({ error: "Email and credential are required" }),
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

    // Get stored challenge
    const { data: challengeRecord, error: challengeError } = await supabaseAdmin
      .from("passkey_challenges")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
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

    // Verify the challenge matches from clientDataJSON
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

    // Create or get user - store password for session creation
    let userId: string;
    let userPassword: string = crypto.randomUUID();

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    if (existingUser) {
      userId = existingUser.id;
      // Update password so we can sign in
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: userPassword,
      });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth
        .admin.createUser({
          email,
          email_confirm: true,
          password: userPassword,
        });

      if (createError || !newUser.user) {
        console.error("User creation error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create account" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      userId = newUser.user.id;
    }

    // Store credential
    const credentialId = credential.id;

    // Check if credential already exists
    const { data: existingCred } = await supabaseAdmin
      .from("passkey_credentials")
      .select("id")
      .eq("credential_id", credentialId)
      .single();

    if (!existingCred) {
      const { error: credError } = await supabaseAdmin
        .from("passkey_credentials")
        .insert({
          user_id: userId,
          credential_id: credentialId,
          public_key: {
            attestationObject: credential.response.attestationObject,
          },
          counter: 0,
          transports: credential.response.transports || ["internal"],
        });

      if (credError) {
        console.error("Credential insert error:", credError);
        return new Response(
          JSON.stringify({ error: "Failed to store passkey" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Delete used challenge
    await supabaseAdmin
      .from("passkey_challenges")
      .delete()
      .eq("id", challengeRecord.id);

    // Create a real Supabase session by signing in with password
    // Use a regular client (not admin) to get proper session tokens
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: signInData, error: signInError } = await supabaseClient.auth
      .signInWithPassword({
        email,
        password: userPassword,
      });

    if (signInError || !signInData.session) {
      console.error("Sign in error:", signInError);
      return new Response(
        JSON.stringify({
          verified: true,
          user_id: userId,
          error: "Account created but session failed. Please try signing in.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Session created successfully for user:", userId);

    return new Response(
      JSON.stringify({
        verified: true,
        user_id: userId,
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("passkey-register-verify error:", error);
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
