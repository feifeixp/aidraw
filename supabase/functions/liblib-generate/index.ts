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
    const { 
      prompt, 
      modelId, 
      modelName, 
      checkpointId, 
      loraIds = [], 
      width = 1024, 
      height = 1024, 
      imgCount = 1 
    } = await req.json();
    
    if (!prompt || !modelId || !modelName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: prompt, modelId, modelName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 至少需要一个模型（底模或LoRA）
    if (!checkpointId && (!loraIds || loraIds.length === 0)) {
      return new Response(
        JSON.stringify({ error: "At least one of checkpointId or loraIds is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 最多支持5个LoRA
    if (loraIds && loraIds.length > 5) {
      return new Response(
        JSON.stringify({ error: "Maximum 5 LoRA models are allowed" }),
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
    const timestamp = Date.now().toString();
    const signatureNonce = crypto.randomUUID().substring(0, 10);
    const uri = "/api/generate/webui/text2img";
    const content = `${uri}&${timestamp}&${signatureNonce}`;
    
    console.log("=== Signature Generation ===");
    console.log("URI:", uri);
    console.log("Timestamp:", timestamp);
    console.log("SignatureNonce:", signatureNonce);
    console.log("Content to sign:", content);
    console.log("SecretKey length:", LIBLIB_SECRET_KEY.length);

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
    
    console.log("Generated signature:", signature);

    // 初始化Supabase客户端
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取底模配置（如果有）
    let checkpointData = null;
    if (checkpointId) {
      const { data, error } = await supabase
        .from("liblib_models")
        .select("*")
        .eq("model_id", checkpointId)
        .single();
      
      if (!error && data) {
        checkpointData = data;
      } else {
        console.error("Failed to fetch checkpoint data:", error);
      }
    }

    // 获取LoRA配置（如果有）
    let loraDataList: any[] = [];
    if (loraIds && loraIds.length > 0) {
      const { data, error } = await supabase
        .from("liblib_models")
        .select("*")
        .in("model_id", loraIds);
      
      if (!error && data) {
        loraDataList = data;
      } else {
        console.error("Failed to fetch LoRA data:", error);
      }
    }

    // 确定使用哪个模型的base_algo（优先使用底模的）
    const primaryModel = checkpointData || loraDataList[0];
    if (!primaryModel) {
      return new Response(
        JSON.stringify({ error: "No valid model configuration found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 创建历史记录（包含所有LoRA模型）
    const loraModels = loraDataList.length > 0 
      ? loraDataList.map(lora => ({
          modelId: lora.lora_version_id,
          weight: lora.lora_weight || 0.8
        }))
      : null;

    const { data: historyRecord, error: historyError } = await supabase
      .from("generation_history")
      .insert({
        prompt,
        model_id: modelId,
        model_name: modelName,
        status: "processing",
        template_uuid: primaryModel.base_algo === 3 ? "6f7c4652458d4802969f8d089cf5b91f" : "e10adc3949ba59abbe56e057f20f883e",
        checkpoint_id: checkpointData?.checkpoint_id || null,
        lora_models: loraModels,
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

    console.log("Calling LibLib API with config:", {
      baseAlgo: primaryModel.base_algo,
      checkpointId: checkpointData?.checkpoint_id,
      loraCount: loraDataList.length,
      loraVersionIds: loraDataList.map(l => l.lora_version_id),
      sampler: primaryModel.sampler,
      cfgScale: primaryModel.cfg_scale,
    });

    // Build URL with signature parameters
    const apiUrl = `https://openapi.liblibai.cloud${uri}?AccessKey=${LIBLIB_ACCESS_KEY}&Signature=${signature}&Timestamp=${timestamp}&SignatureNonce=${signatureNonce}`;

    // 根据base_algo选择正确的模板UUID
    let templateUuid: string;
    if (primaryModel.base_algo === 3) {
      // F.1 (Flux) 模型使用专用模板
      templateUuid = "6f7c4652458d4802969f8d089cf5b91f";
    } else {
      // 1.5和XL模型使用通用模板
      templateUuid = "e10adc3949ba59abbe56e057f20f883e";
    }

    // 构建生成参数
    const generateParams: any = {
      prompt: prompt,
      negativePrompt: defaultNegativePrompt,
      sampler: primaryModel.sampler || 1,
      steps: 20,
      cfgScale: primaryModel.cfg_scale || 3.5,
      width: width,
      height: height,
      imgCount: imgCount,
      randnSource: primaryModel.randn_source || 0,
      seed: -1,
      restoreFaces: 0,
    };

    const requestBody: any = {
      templateUuid: templateUuid,
      generateParams: generateParams,
    };

    // 如果有底模，添加checkPointId
    if (checkpointData?.checkpoint_id) {
      requestBody.checkPointId = checkpointData.checkpoint_id;
      console.log("Using checkpoint model:", checkpointData.checkpoint_id);
    }

    // 如果有LoRA，添加additionalNetwork（支持多个LoRA）
    if (loraDataList.length > 0) {
      generateParams.additionalNetwork = loraDataList.map(lora => ({
        modelId: lora.lora_version_id,
        weight: lora.lora_weight || 0.8,
      }));
      console.log("Using LoRA models:", loraDataList.map(l => `${l.lora_version_id} (weight: ${l.lora_weight})`).join(", "));
    }

    console.log("LibLib API request body:", JSON.stringify(requestBody, null, 2));
    console.log("Calling LibLib API at URL:", apiUrl);
    console.log("Using Access Key:", LIBLIB_ACCESS_KEY);

    // 定义后台处理函数
    const processGeneration = async () => {
      try {
        console.log("Background task: Starting LibLib API call");
        
        // 调用LibLib API with extended timeout (180 seconds for initial generation request)
        const REQUEST_TIMEOUT = 180000; // 180 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error(`Background: Request timeout after ${REQUEST_TIMEOUT/1000} seconds, aborting...`);
          controller.abort();
        }, REQUEST_TIMEOUT);
    
        let liblibResponse;
        try {
          const startTime = Date.now();
          console.log("Background: Starting LibLib API call at:", new Date(startTime).toISOString());
          
          liblibResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          
          const endTime = Date.now();
          console.log(`Background: LibLib API responded in ${endTime - startTime}ms`);
          console.log("Background: Response status:", liblibResponse.status);
          console.log("Background: Response headers:", JSON.stringify(Object.fromEntries(liblibResponse.headers.entries())));
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error("Background: === LibLib API FETCH ERROR ===");
          console.error("Background: Error type:", fetchError instanceof Error ? fetchError.name : typeof fetchError);
          console.error("Background: Error message:", fetchError instanceof Error ? fetchError.message : String(fetchError));
          console.error("Background: Error stack:", fetchError instanceof Error ? fetchError.stack : "N/A");
          
          let errorMessage = fetchError instanceof Error ? fetchError.message : "Network error connecting to LibLib API";
          
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            errorMessage = `Request timeout: LibLib API took too long to respond (>${REQUEST_TIMEOUT/1000}s). The API may be experiencing issues.`;
          }
          
          await supabase
            .from("generation_history")
            .update({
              status: "failed",
              error_message: errorMessage,
            })
            .eq("id", historyRecord.id);
          
          return;
        } finally {
          clearTimeout(timeoutId);
        }

        if (!liblibResponse.ok) {
          const errorText = await liblibResponse.text();
          console.error("Background: === LibLib API ERROR RESPONSE ===");
          console.error("Background: Status code:", liblibResponse.status);
          console.error("Background: Response body:", errorText);
          
          let errorMessage = `API error: ${liblibResponse.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.msg || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          
          await supabase
            .from("generation_history")
            .update({
              status: "failed",
              error_message: errorMessage,
            })
            .eq("id", historyRecord.id);
          
          return;
        }

        const responseText = await liblibResponse.text();
        console.log("Background: === LibLib API SUCCESS RESPONSE ===");
        console.log("Background: Raw response text:", responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
          console.log("Background: Parsed response:", JSON.stringify(result, null, 2));
        } catch (parseError) {
          console.error("Background: Failed to parse JSON response:", parseError);
          await supabase
            .from("generation_history")
            .update({
              status: "failed",
              error_message: "Invalid JSON response from API",
            })
            .eq("id", historyRecord.id);
          
          return;
        }

        const generateUuid = result.data?.generateUuid;
        
        if (!generateUuid) {
          console.error("Background: No generateUuid in response:", result);
          await supabase
            .from("generation_history")
            .update({
              status: "failed",
              error_message: result.msg || "No task UUID returned",
            })
            .eq("id", historyRecord.id);
          
          return;
        }

        console.log("Background: Generation started with UUID:", generateUuid);
        
        // 更新历史记录，添加任务UUID
        await supabase
          .from("generation_history")
          .update({
            task_uuid: generateUuid,
          })
          .eq("id", historyRecord.id);

        // Poll for result - increased to 120 attempts * 2 seconds = 4 minutes max
        let attempts = 0;
        let imageUrl = null;
        const maxAttempts = 120;
        
        while (attempts < maxAttempts && !imageUrl) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
          
          console.log(`Background: Status check attempt ${attempts}/${maxAttempts}`);
      
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
          console.log(`Background: Status check ${attempts}: status=${statusResult.data?.generateStatus}, code=${statusResult.code}`);
          
          if (statusResult.data?.generateStatus === 5) {
            imageUrl = statusResult.data?.images?.[0]?.imageUrl;
            console.log("Background: Generation completed! Image URL:", imageUrl);
            break;
          } else if (statusResult.data?.generateStatus === 4) {
            console.error("Background: Generation failed with status 4");
            throw new Error("Generation failed");
          }
        }

        if (!imageUrl) {
          console.error("Background: Timeout - no image generated after", maxAttempts * 2, "seconds");
          await supabase
            .from("generation_history")
            .update({
              status: "failed",
              error_message: "Generation timeout - please try again",
            })
            .eq("id", historyRecord.id);
          
          return;
        }

        // 更新历史记录为成功
        console.log("Background: Updating history record with image URL");
        await supabase
          .from("generation_history")
          .update({
            status: "completed",
            image_url: imageUrl,
          })
          .eq("id", historyRecord.id);
        
        console.log("Background: Generation process completed successfully");
      } catch (bgError) {
        console.error("Background: Error in background processing:", bgError);
        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: bgError instanceof Error ? bgError.message : "Unknown error",
          })
          .eq("id", historyRecord.id);
      }
    };

    // Start background processing using EdgeRuntime
    console.log("Starting background processing for history ID:", historyRecord.id);
    // @ts-ignore - EdgeRuntime is available in Deno environment
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processGeneration());
      console.log("Background task scheduled with EdgeRuntime.waitUntil");
    } else {
      // Fallback: start async without awaiting
      processGeneration().catch(e => console.error("Background task error:", e));
      console.log("Background task started (fallback mode)");
    }

    // Immediately return with processing status
    console.log("Returning success response with historyId:", historyRecord.id);
    return new Response(
      JSON.stringify({
        success: true,
        status: "processing",
        message: "Image generation started. Please check the history page for results.",
        historyId: historyRecord.id,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
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