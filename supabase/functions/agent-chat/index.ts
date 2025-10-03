import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Agent chat request with messages:", messages.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "你是一个智能AI助手，能够帮助用户进行创作。你可以理解用户的需求，进行对话交流，并在需要时协助生成图片。当用户要求生成图片时，你应该调用generate_image工具。请保持友好、专业的态度，给出清晰准确的回答。" 
          },
          ...messages,
        ],
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "generate_image",
              description: "根据用户描述生成图片。这个工具会自动选择最适合的模型和风格，并优化提示词以生成高质量的图片。",
              parameters: {
                type: "object",
                properties: {
                  user_prompt: {
                    type: "string",
                    description: "用户对图片的描述或需求"
                  },
                  aspect_ratio: {
                    type: "string",
                    enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
                    description: "图片宽高比，默认为1:1"
                  },
                  image_count: {
                    type: "integer",
                    description: "要生成的图片数量，默认为1",
                    minimum: 1,
                    maximum: 4
                  }
                },
                required: ["user_prompt"]
              }
            }
          }
        ],
        tool_choice: "auto"
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "请求过于频繁，请稍后再试" }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "需要充值，请前往设置添加余额" }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI 服务�时不可用" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create a transform stream to handle tool calls
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';
        let toolCallBuffer: any = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta;

                  // Handle tool calls
                  if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                      if (toolCall.function?.name === 'generate_image') {
                        if (!toolCallBuffer) {
                          toolCallBuffer = { id: toolCall.id, arguments: '' };
                        }
                        if (toolCall.function.arguments) {
                          toolCallBuffer.arguments += toolCall.function.arguments;
                        }
                      }
                    }
                  }

                  // Forward the original message
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }

          // Execute tool call if present
          if (toolCallBuffer && toolCallBuffer.arguments) {
            try {
              const args = JSON.parse(toolCallBuffer.arguments);
              console.log('Executing generate_image with args:', args);

              // Initialize Supabase client
              const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

              // Call ai-enhance-prompt to get optimized prompt and models
              const enhanceResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-enhance-prompt`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userInput: args.user_prompt }),
              });

              const enhanceData = await enhanceResponse.json();
              console.log('Enhanced prompt data:', enhanceData);

              // Get model info from Supabase
              const { data: checkpointModel } = await supabase
                .from('liblib_models')
                .select('*')
                .eq('model_id', enhanceData.checkpoint_id)
                .single();

              const { data: loraModels } = await supabase
                .from('liblib_models')
                .select('*')
                .in('lora_version_id', enhanceData.lora_ids || []);

              // Build model name
              const loraNames = loraModels?.map(l => l.name).join(' + ') || '';
              const displayModelName = checkpointModel 
                ? (loraNames ? `${checkpointModel.name} + ${loraNames}` : checkpointModel.name)
                : loraNames || "未知模型";
              const primaryModelId = checkpointModel?.model_id || loraModels?.[0]?.model_id || '';

              // Get aspect ratio dimensions
              const aspectRatioMap: Record<string, {width: number, height: number}> = {
                "1:1": { width: 1024, height: 1024 },
                "16:9": { width: 1024, height: 576 },
                "9:16": { width: 576, height: 1024 },
                "4:3": { width: 1024, height: 768 },
                "3:4": { width: 768, height: 1024 },
              };
              const dimensions = aspectRatioMap[args.aspect_ratio || '1:1'] || { width: 1024, height: 1024 };

              // Call liblib-generate with enhanced parameters
              const generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/liblib-generate`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  prompt: enhanceData.enhanced_prompt,
                  modelId: primaryModelId,
                  modelName: displayModelName,
                  checkpointId: enhanceData.checkpoint_id,
                  loraIds: enhanceData.lora_ids || [],
                  width: dimensions.width,
                  height: dimensions.height,
                  imgCount: args.image_count || 1,
                }),
              });

              const generateData = await generateResponse.json();
              console.log('Generation result:', generateData);

              if (!generateData.success || !generateData.historyId) {
                throw new Error(generateData.error || 'Generation failed');
              }

              // Poll generation_history table for completion
              const historyId = generateData.historyId;
              let pollAttempts = 0;
              const maxPollAttempts = 60; // 2 minutes max
              let finalImages: string[] = [];
              let generationSuccess = false;

              while (pollAttempts < maxPollAttempts && !generationSuccess) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                pollAttempts++;

                const { data: historyData, error: historyError } = await supabase
                  .from('generation_history')
                  .select('*')
                  .eq('id', historyId)
                  .single();

                if (historyError) {
                  console.error('Polling error:', historyError);
                  continue;
                }

                if (historyData.status === 'completed' && (historyData.images || historyData.image_url)) {
                  finalImages = historyData.images || (historyData.image_url ? [historyData.image_url] : []);
                  generationSuccess = true;
                  break;
                } else if (historyData.status === 'failed') {
                  throw new Error(historyData.error_message || 'Generation failed');
                }
              }

              if (!generationSuccess) {
                throw new Error('Generation timeout - images are still being processed');
              }

              // Send tool call result as a message
              const toolResultMessage = {
                role: 'assistant',
                content: `图片生成完成！使用模型：${displayModelName}，提示词已优化为："${enhanceData.enhanced_prompt}"`,
                tool_call_id: toolCallBuffer.id,
                images: finalImages,
                metadata: {
                  checkpoint_id: enhanceData.checkpoint_id,
                  lora_ids: enhanceData.lora_ids,
                  aspect_ratio: args.aspect_ratio || '1:1',
                  image_count: args.image_count || 1,
                  reasoning: enhanceData.reasoning
                }
              };

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                choices: [{
                  delta: { 
                    content: '',
                    tool_result: toolResultMessage
                  }
                }]
              })}\n\n`));
            } catch (e) {
              console.error('Error executing tool call:', e);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                choices: [{
                  delta: { 
                    content: `抱歉，生成图片时出错了：${e instanceof Error ? e.message : '未知错误'}`
                  }
                }]
              })}\n\n`));
            }
          }

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Agent chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "未知错误" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
