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
    const { prompt, modelId, modelName, width = 1024, height = 1024, imgCount = 1 } = await req.json();
    
    if (!prompt || !modelId || !modelName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: prompt, modelId, modelName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 默认负面提示词
    const defaultNegativePrompt = "ng_deepnegative_v1_75t,(badhandv4:1.2),EasyNegative,(worst quality:2),";

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

    // 获取模型配置
    const { data: modelData, error: modelError } = await supabase
      .from("liblib_models")
      .select("*")
      .eq("model_id", modelId)
      .single();

    if (modelError || !modelData) {
      console.error("Failed to fetch model data:", modelError);
      return new Response(
        JSON.stringify({ error: "Model not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log("Calling LibLib API with signature auth and model config:", {
      baseAlgo: modelData.base_algo,
      checkpointId: modelData.checkpoint_id,
      loraVersionId: modelData.lora_version_id,
      sampler: modelData.sampler,
      cfgScale: modelData.cfg_scale,
    });

    // Build URL with signature parameters
    const apiUrl = `https://openapi.liblibai.cloud${uri}?AccessKey=${LIBLIB_ACCESS_KEY}&Signature=${signature}&Timestamp=${timestamp}&SignatureNonce=${signatureNonce}`;

    // 构建生成参数
    const generateParams: any = {
      prompt: prompt,
      negativePrompt: defaultNegativePrompt,
      sampler: modelData.sampler || 15,
      steps: 20,
      cfgScale: modelData.cfg_scale || 7,
      width: width,
      height: height,
      imgCount: imgCount,
      randnSource: modelData.randn_source || 0,
      seed: -1,
      restoreFaces: 0,
    };

    const requestBody: any = {
      templateUuid: "e10adc3949ba59abbe56e057f20f883e",
    };

    // 根据base_algo选择不同的生成方式
    if (modelData.base_algo === 3) {
      // Flux模型：直接使用modelUuid
      requestBody.modelUuid = modelData.lora_version_id || modelId;
      requestBody.generateParams = generateParams;
    } else {
      // SD/XL模型：只使用lora作为additionalNetwork，不使用checkPointId
      // 因为LibLib API对于lora模型不需要单独的checkPointId
      if (modelData.lora_version_id) {
        generateParams.additionalNetwork = [
          {
            modelId: modelData.lora_version_id,
            weight: modelData.lora_weight || 0.8,
          },
        ];
      }
      
      requestBody.generateParams = generateParams;
    }

    console.log("LibLib API request body:", JSON.stringify(requestBody, null, 2));
    console.log("Calling LibLib API at URL:", apiUrl);
    console.log("Using Access Key:", LIBLIB_ACCESS_KEY);

    // 调用LibLib API with timeout (45 seconds for initial generation request)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error("Request timeout after 45 seconds, aborting...");
      controller.abort();
    }, 45000); // 45 second timeout
    
    let liblibResponse;
    try {
      const startTime = Date.now();
      console.log("Starting LibLib API call at:", new Date(startTime).toISOString());
      
      liblibResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      const endTime = Date.now();
      console.log(`LibLib API responded in ${endTime - startTime}ms`);
      console.log("Response status:", liblibResponse.status);
      console.log("Response headers:", JSON.stringify(Object.fromEntries(liblibResponse.headers.entries())));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error("=== LibLib API FETCH ERROR ===");
      console.error("Error type:", fetchError instanceof Error ? fetchError.name : typeof fetchError);
      console.error("Error message:", fetchError instanceof Error ? fetchError.message : String(fetchError));
      console.error("Error stack:", fetchError instanceof Error ? fetchError.stack : "N/A");
      console.error("API URL:", apiUrl);
      console.error("Timestamp:", new Date().toISOString());
      
      let errorMessage = fetchError instanceof Error ? fetchError.message : "Network error connecting to LibLib API";
      
      // Check if it's a timeout error
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        errorMessage = "Request timeout: LibLib API took too long to respond (>45s). The API may be experiencing issues.";
        console.error("=== TIMEOUT ERROR ===");
        console.error("This suggests the LibLib API is not responding. Possible causes:");
        console.error("1. LibLib API service is down or slow");
        console.error("2. Network connectivity issues");
        console.error("3. API authentication issues (check LIBLIB_API_KEY)");
      }
      
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", historyRecord.id);

      return new Response(
        JSON.stringify({ 
          error: "Failed to connect to image generation service", 
          details: errorMessage,
          historyId: historyRecord.id 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!liblibResponse.ok) {
      const errorText = await liblibResponse.text();
      console.error("=== LibLib API ERROR RESPONSE ===");
      console.error("Status code:", liblibResponse.status);
      console.error("Status text:", liblibResponse.statusText);
      console.error("Response body:", errorText);
      console.error("Response headers:", JSON.stringify(Object.fromEntries(liblibResponse.headers.entries())));
      
      let errorMessage = `API error: ${liblibResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.msg || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      // 更新历史记录为失败
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", historyRecord.id);

      return new Response(
        JSON.stringify({ 
          error: "Failed to generate image", 
          details: errorMessage,
          historyId: historyRecord.id 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseText = await liblibResponse.text();
    console.log("=== LibLib API SUCCESS RESPONSE ===");
    console.log("Raw response text:", responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
      console.log("Parsed response:", JSON.stringify(result, null, 2));
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: "Invalid JSON response from API",
        })
        .eq("id", historyRecord.id);
      
      return new Response(
        JSON.stringify({ error: "Invalid response from image generation service", historyId: historyRecord.id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LibLib API returns a task UUID for async generation
    const generateUuid = result.data?.generateUuid;
    
    if (!generateUuid) {
      console.error("No generateUuid in response:", result);
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.msg || "No task UUID returned",
        })
        .eq("id", historyRecord.id);

      return new Response(
        JSON.stringify({ error: "Failed to start generation", details: result.msg, historyId: historyRecord.id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generation started with UUID:", generateUuid);

    // Poll for result with increased attempts and shorter intervals
    let attempts = 0;
    let imageUrl = null;
    const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
    
    while (attempts < maxAttempts && !imageUrl) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      console.log(`Status check attempt ${attempts}/${maxAttempts}`);
      
      // 为状态检查生成新的签名参数
      const statusUri = "/api/generate/webui/status";
      const statusTimestamp = Date.now();
      const statusNonce = crypto.randomUUID().substring(0, 10);
      const statusContent = `${statusUri}&${statusTimestamp}&${statusNonce}`;
      
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
      
      const statusUrl = `https://openapi.liblibai.cloud${statusUri}?AccessKey=${LIBLIB_ACCESS_KEY}&Signature=${statusSignature}&Timestamp=${statusTimestamp}&SignatureNonce=${statusNonce}`;
      
      const statusResponse = await fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateUuid }),
      });
      
      const statusResult = await statusResponse.json();
      console.log(`Status check ${attempts}: status=${statusResult.data?.generateStatus}, code=${statusResult.code}`);
      
      if (statusResult.data?.generateStatus === 5) {
        imageUrl = statusResult.data?.images?.[0]?.imageUrl;
        console.log("Generation completed! Image URL:", imageUrl);
        break;
      } else if (statusResult.data?.generateStatus === 4) {
        console.error("Generation failed with status 4");
        throw new Error("Generation failed");
      }
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