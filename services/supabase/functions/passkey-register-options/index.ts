import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RP_ID = Deno.env.get("PASSKEY_RP_ID") || "piotrgawel5.github.io";
const RP_NAME = Deno.env.get("PASSKEY_RP_NAME") || "Project Delta";

// Base64URL encoding
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Generate random challenge
function generateChallenge(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64URLEncode(buffer);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Check if user already exists with passkey
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    if (existingUser) {
      const { data: creds } = await supabaseAdmin
        .from("passkey_credentials")
        .select("credential_id")
        .eq("user_id", existingUser.id);

      if (creds && creds.length > 0) {
        return new Response(
          JSON.stringify({
            error: "Account already exists. Please sign in with your passkey.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Generate WebAuthn registration options manually
    const challenge = generateChallenge();
    const userId = base64URLEncode(
      new TextEncoder().encode(crypto.randomUUID()),
    );

    const options = {
      challenge,
      rp: {
        name: RP_NAME,
        id: RP_ID,
      },
      user: {
        id: userId,
        name: email,
        displayName: email.split("@")[0],
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      timeout: 60000,
      attestation: "none",
      excludeCredentials: [],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "preferred",
      },
    };

    // Store challenge with email
    const { error: challengeError } = await supabaseAdmin
      .from("passkey_challenges")
      .insert({
        challenge,
        email,
        user_id: existingUser?.id,
      });

    if (challengeError) {
      console.error("Challenge insert error:", challengeError);
      return new Response(
        JSON.stringify({ error: "Failed to create challenge" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify(options),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("passkey-register-options error:", error);
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
