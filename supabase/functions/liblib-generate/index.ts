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

    const LIBLIB_API_KEY = Deno.env.get("LIBLIB_API_KEY");
    if (!LIBLIB_API_KEY) {
      console.error("LIBLIB_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "LibLib API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log("Calling LibLib API with:", { prompt, modelId });

    // 调用LibLib API
    // 注意：这里使用通用的API端点，实际端点需要根据LibLib文档调整
    const liblibResponse = await fetch("https://api.liblibai.com/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LIBLIB_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        prompt: prompt,
        // 可能需要的其他参数
        width: 1024,
        height: 1024,
        num_images: 1,
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

    // 假设API返回格式为 { images: [{ url: "..." }] }
    // 实际格式需要根据LibLib文档调整
    const imageUrl = result.images?.[0]?.url || result.image_url || result.url;

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