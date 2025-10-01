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
    const { userPrompt } = await req.json();
    
    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing userPrompt" }),
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

    // 构建模型信息供AI分析
    const modelsInfo = models.map(m => ({
      model_id: m.model_id,
      name: m.name,
      description: m.description,
      tags: m.tags,
      features: m.features,
    }));

    const systemPrompt = `你是一个AI绘图助手，专门根据用户需求选择最合适的LibLib模型。

可用模型列表：
${JSON.stringify(modelsInfo, null, 2)}

请分析用户的需求，选择最合适的模型。考虑以下因素：
1. 模型的描述和标签是否匹配用户需求
2. 模型的特征是否适合用户想要的风格
3. 如果没有完美匹配，选择最接近的模型

请以JSON格式返回：
{
  "model_id": "选择的模型ID",
  "model_name": "模型名称",
  "reasoning": "选择这个模型的理由（简短说明）"
}`;

    console.log("Calling Lovable AI for model selection");

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
          { role: "user", content: userPrompt }
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
        JSON.stringify({ error: "AI selection failed" }),
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
    let selection;
    try {
      // 尝试提取JSON（AI可能在回答中包含其他文本）
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        selection = JSON.parse(jsonMatch[0]);
      } else {
        selection = JSON.parse(aiMessage);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiMessage);
      // 如果AI没有返回有效JSON，返回第一个模型作为fallback
      selection = {
        model_id: models[0].model_id,
        model_name: models[0].name,
        reasoning: "使用默认模型",
      };
    }

    return new Response(
      JSON.stringify(selection),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-select-model:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});