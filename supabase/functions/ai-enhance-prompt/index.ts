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
    const { userInput } = await req.json();
    
    if (!userInput) {
      return new Response(
        JSON.stringify({ error: "Missing userInput" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 初始化Supabase客户端获取模型列表
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取活跃的模型列表
    const { data: models, error: modelsError } = await supabase
      .from("liblib_models")
      .select("*")
      .eq("is_active", true);

    if (modelsError || !models || models.length === 0) {
      console.error("Failed to fetch models:", modelsError);
      return new Response(
        JSON.stringify({ error: "No models available" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${models.length} active models`);

    // 分离底模和风格模型
    const checkpoints = models.filter(m => m.checkpoint_id);
    const loras = models.filter(m => m.lora_version_id);

    const checkpointsInfo = checkpoints.map(m => ({
      model_id: m.model_id,
      name: m.name,
      description: m.description,
      tags: m.tags,
    }));

    const lorasInfo = loras.map(m => ({
      model_id: m.model_id,
      name: m.name,
      description: m.description,
      tags: m.tags,
    }));

    const systemPrompt = `你是一个专业的AI绘图提示词优化助手。你的任务是：
1. 将用户的简短输入扩展为详细、专业的绘图提示词（Stable Diffusion风格）
2. 根据用户需求推荐最合适的底模（checkpoint）
3. 推荐1-3个适合的风格模型（LoRA）

可用底模列表：
${JSON.stringify(checkpointsInfo, null, 2)}

可用风格模型列表：
${JSON.stringify(lorasInfo, null, 2)}

请分析用户输入，生成：
1. enhanced_prompt：优化后的详细提示词（英文，包含主体、环境、光线、风格等细节）
2. checkpoint_id：推荐的底模ID
3. lora_ids：推荐的风格模型ID数组（1-3个）
4. reasoning：推荐理由（中文，简短说明）

返回JSON格式：
{
  "enhanced_prompt": "详细的英文提示词",
  "checkpoint_id": "推荐的底模ID",
  "checkpoint_name": "底模名称",
  "lora_ids": ["风格1 ID", "风格2 ID"],
  "lora_names": ["风格1名称", "风格2名称"],
  "reasoning": "推荐理由"
}`;

    console.log("Calling Lovable AI for prompt enhancement");

    // 调用Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI enhancement failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    console.log("AI response:", aiResult);

    const aiMessage = aiResult.choices?.[0]?.message?.content;
    if (!aiMessage) {
      console.error("No AI message in response");
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 解析AI返回的JSON
    let result;
    try {
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(aiMessage);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiMessage);
      // 如果解析失败，返回默认值
      result = {
        enhanced_prompt: userInput,
        checkpoint_id: checkpoints[0]?.model_id,
        checkpoint_name: checkpoints[0]?.name,
        lora_ids: [],
        lora_names: [],
        reasoning: "使用默认配置",
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-enhance-prompt:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
