import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, modelId, modelName } = await req.json();
    
    if (!prompt || !modelId || !modelName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: prompt, modelId, modelName" }),
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
    const timestamp = Date.now();
    const signatureNonce = crypto.randomUUID().substring(0, 10);
    const uri = "/api/generate/webui/text2img";
    const content = `${uri}&${timestamp}&${signatureNonce}`;

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

    // 初始化Supabase客户端
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 创建历史记录
    const { data: historyRecord, error: historyError } = await supabase
      .from("generation_history")
      .insert({
        prompt,
        model_id: modelId,
        model_name: modelName,
        status: "processing",
      })
      .select()
      .single();

    if (historyError) {
      console.error("Failed to create history record:", historyError);
      return new Response(
        JSON.stringify({ error: "Failed to create history record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling LibLib API with signature auth");

    // Build URL with signature parameters
    const apiUrl = `https://openapi.liblibai.cloud${uri}?AccessKey=${LIBLIB_ACCESS_KEY}&Signature=${signature}&Timestamp=${timestamp}&SignatureNonce=${signatureNonce}`;

    // 调用LibLib API
    const liblibResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateUuid: "6f7c4652458d4802969f8d089cf5b91f",
        generateParams: {
          prompt: prompt,
          steps: 20,
          width: 1024,
          height: 1024,
          imgCount: 1,
          seed: -1,
          restoreFaces: 0,
        },
      }),
    });

    if (!liblibResponse.ok) {
      const errorText = await liblibResponse.text();
      console.error("LibLib API error:", liblibResponse.status, errorText);
      
      // 更新历史记录为失败
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: `API error: ${liblibResponse.status}`,
        })
        .eq("id", historyRecord.id);

      return new Response(
        JSON.stringify({ 
          error: "Failed to generate image", 
          details: errorText,
          historyId: historyRecord.id 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await liblibResponse.json();
    console.log("LibLib API response:", result);

    // LibLib API returns a task UUID for async generation
    const generateUuid = result.data?.generateUuid;
    
    if (!generateUuid) {
      console.error("No generateUuid in response:", result);
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: "No task UUID returned",
        })
        .eq("id", historyRecord.id);

      return new Response(
        JSON.stringify({ error: "Failed to start generation", historyId: historyRecord.id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll for result (simplified - in production use webhooks or job queue)
    let attempts = 0;
    let imageUrl = null;
    
    while (attempts < 30 && !imageUrl) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusUri = "/api/generate/webui/status";
      const statusContent = `${statusUri}&${Date.now()}&${crypto.randomUUID().substring(0, 10)}`;
      const statusKeyData = encoder.encode(LIBLIB_SECRET_KEY);
      const statusMessageData = encoder.encode(statusContent);
      
      const statusCryptoKey = await crypto.subtle.importKey(
        "raw",
        statusKeyData,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      );
      
      const statusSignatureBuffer = await crypto.subtle.sign("HMAC", statusCryptoKey, statusMessageData);
      const statusSignatureArray = new Uint8Array(statusSignatureBuffer);
      const statusSignature = btoa(String.fromCharCode(...statusSignatureArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      const statusTimestamp = Date.now();
      const statusNonce = crypto.randomUUID().substring(0, 10);
      const statusUrl = `https://openapi.liblibai.cloud${statusUri}?AccessKey=${LIBLIB_ACCESS_KEY}&Signature=${statusSignature}&Timestamp=${statusTimestamp}&SignatureNonce=${statusNonce}`;
      
      const statusResponse = await fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateUuid }),
      });
      
      const statusResult = await statusResponse.json();
      console.log("Status check:", statusResult);
      
      if (statusResult.data?.generateStatus === "SUCCEED") {
        imageUrl = statusResult.data?.images?.[0]?.url;
        break;
      } else if (statusResult.data?.generateStatus === "FAILED") {
        throw new Error("Generation failed");
      }
      
      attempts++;
    }

    if (!imageUrl) {
      console.error("No image URL in response:", result);
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: "No image URL in response",
        })
        .eq("id", historyRecord.id);

      return new Response(
        JSON.stringify({ error: "No image generated", historyId: historyRecord.id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 更新历史记录为成功
    await supabase
      .from("generation_history")
      .update({
        status: "completed",
        image_url: imageUrl,
      })
      .eq("id", historyRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        historyId: historyRecord.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in liblib-generate:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});