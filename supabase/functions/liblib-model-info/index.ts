import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { versionUuid } = await req.json();
    
    if (!versionUuid) {
      return new Response(
        JSON.stringify({ error: "Missing versionUuid parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LIBLIB_SECRET_KEY = Deno.env.get("LIBLIB_API_KEY");
    const LIBLIB_ACCESS_KEY = "Pt6EX8XqnGpmwAerrYkhsQ";
    
    if (!LIBLIB_SECRET_KEY) {
      console.error("LIBLIB_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "LibLib Secret Key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signature parameters
    const timestamp = Date.now().toString();
    const signatureNonce = crypto.randomUUID().substring(0, 10);
    const uri = "/api/model/version/get";
    const content = `${uri}&${timestamp}&${signatureNonce}`;

    console.log("=== Model Info Signature Generation ===");
    console.log("URI:", uri);
    console.log("Timestamp:", timestamp);
    console.log("SignatureNonce:", signatureNonce);
    console.log("Content to sign:", content);

    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(LIBLIB_SECRET_KEY);
    const messageData = encoder.encode(content);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const signatureArray = new Uint8Array(signatureBuffer);
    const signature = btoa(String.fromCharCode(...signatureArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const apiUrl = `https://openapi.liblibai.cloud${uri}?AccessKey=${LIBLIB_ACCESS_KEY}&Signature=${signature}&Timestamp=${timestamp}&SignatureNonce=${signatureNonce}`;

    console.log("Fetching model info for versionUuid:", versionUuid);
    console.log("API URL:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        versionUuid: versionUuid,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LibLib API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch model info", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("LibLib API response:", JSON.stringify(result, null, 2));

    if (result.code !== 0 || !result.data) {
      console.error("LibLib API returned error:", result);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: result.msg || "Failed to fetch model info" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // showType: 1=LoRA, 2=Checkpoint (根据实际API返回修正)
    const modelType = result.data.showType === 2 ? "checkpoint" : "lora";
    console.log("Successfully fetched model info:", result.data.modelName || "Unknown", "Type:", modelType);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...result.data,
          modelType, // 添加模型类型标识
        },
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in liblib-model-info:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
