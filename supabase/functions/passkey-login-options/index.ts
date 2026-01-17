import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RP_ID = Deno.env.get("PASSKEY_RP_ID") || "piotrgawel5.github.io";

// Base64URL encoding/decoding
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Generate challenge
    const challenge = generateChallenge();

    // Store challenge
    const { data: challengeRecord, error: challengeError } = await supabaseAdmin
      .from("passkey_challenges")
      .insert({ challenge })
      .select("id")
      .single();

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

    // Return WebAuthn authentication options
    const options = {
      challenge,
      rpId: RP_ID,
      timeout: 60000,
      userVerification: "preferred",
      allowCredentials: [], // Empty for discoverable credentials
      challengeId: challengeRecord.id,
    };

    return new Response(
      JSON.stringify(options),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("passkey-login-options error:", error);
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
