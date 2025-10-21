import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scriptText, referenceImages } = await req.json();

    if (!scriptText || typeof scriptText !== 'string') {
      return new Response(
        JSON.stringify({ error: '剧本文本不能为空' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return new Response(
        JSON.stringify({ error: '至少需要一张参考图片' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (referenceImages.length > 4) {
      return new Response(
        JSON.stringify({ error: '最多只能上传4张参考图片' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('开始生成AI分镜，剧本长度:', scriptText.length, '参考图片数量:', referenceImages.length);

    // 分析剧本，将其分割成多个场景
    const scenes = analyzeScriptScenes(scriptText);
    console.log('分析出场景数:', scenes.length);

    const generatedImages: string[] = [];

    // 为每个场景生成分镜
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`生成第 ${i + 1}/${scenes.length} 个场景分镜...`);

      // 构建提示词
      const prompt = buildStoryboardPrompt(scene, scriptText);

      // 构建消息内容
      const content: any[] = [
        { type: "text", text: prompt }
      ];

      // 添加参考图片
      for (const imageUrl of referenceImages) {
        content.push({
          type: "image_url",
          image_url: { url: imageUrl }
        });
      }

      // 调用 Lovable AI 生成图片
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: content
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("API请求频率过高，请稍后再试");
        }
        if (response.status === 402) {
          throw new Error("Lovable AI额度不足，请充值后再试");
        }
        const errorText = await response.text();
        console.error("Lovable AI错误:", response.status, errorText);
        throw new Error(`图片生成失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('Lovable AI响应:', JSON.stringify(data).substring(0, 200));

      // 提取生成的图片
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (imageUrl) {
        generatedImages.push(imageUrl);
        console.log(`场景 ${i + 1} 生成成功`);
      } else {
        console.error(`场景 ${i + 1} 未生成图片`, data);
      }

      // 避免过快请求导致限流
      if (i < scenes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`成功生成 ${generatedImages.length} 张分镜图片`);

    return new Response(
      JSON.stringify({ images: generatedImages, scenesCount: scenes.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI分镜生成错误:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '生成失败',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// 分析剧本，将其分割成多个场景
function analyzeScriptScenes(scriptText: string): string[] {
  const scenes: string[] = [];
  
  // 按照换行、场景标记等分割剧本
  const lines = scriptText.split(/\n+/);
  let currentScene = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    // 检测场景分隔符（如：场景1、镜头1、Scene 1等）
    const isSceneMarker = /^(场景|镜头|分镜|Scene|Shot)\s*\d+/i.test(trimmedLine);
    
    if (isSceneMarker && currentScene) {
      // 保存当前场景，开始新场景
      scenes.push(currentScene.trim());
      currentScene = trimmedLine;
    } else {
      // 累积到当前场景
      currentScene += (currentScene ? ' ' : '') + trimmedLine;
      
      // 如果当前场景太长（超过500字），自动分割
      if (currentScene.length > 500) {
        scenes.push(currentScene.trim());
        currentScene = '';
      }
    }
  }
  
  // 添加最后一个场景
  if (currentScene.trim()) {
    scenes.push(currentScene.trim());
  }
  
  // 如果没有明确的场景分割，按段落自动分割
  if (scenes.length === 0) {
    const paragraphs = scriptText.split(/\n\n+/).filter(p => p.trim());
    return paragraphs.length > 0 ? paragraphs : [scriptText];
  }
  
  // 最多生成8个场景
  return scenes.slice(0, 8);
}

// 构建分镜生成提示词
function buildStoryboardPrompt(sceneText: string, fullScript: string): string {
  // 从完整剧本中识别角色
  const characters = extractCharacters(fullScript);
  const charactersText = characters.length > 0 
    ? `角色包括：${characters.join('、')}。` 
    : '';
  
  return `根据以下剧本场景内容生成干净的手绘动画电影分镜线稿。

场景内容：${sceneText}

参考图片展示了本剧的角色造型。${charactersText}请仔细观察参考图片中每个角色的：
- 脸型、五官特征
- 发型、发色
- 服装风格
- 身体比例和姿态

要求：
1. 严格保持参考图片中角色的画风和造型特征
2. 根据场景描述安排角色的动作、表情和位置
3. 使用纯白色背景，不绘制任何场景元素
4. 画面简洁清晰，只包含必要的角色和动作
5. 线条流畅，符合动画分镜的绘画风格
6. 不要添加文字、标注或其他多余内容
7. 保持黑白线稿风格，清晰易读

请生成该场景的分镜线稿图。`;
}

// 从剧本中提取角色名称
function extractCharacters(scriptText: string): string[] {
  const characters = new Set<string>();
  
  // 匹配常见的角色名称格式
  const patterns = [
    /【(.+?)】/g,  // 【角色名】
    /「(.+?)」/g,  // 「角色名」
    /（(.+?)）/g,  // （角色名）
    /\((.+?)\)/g,  // (角色名)
  ];
  
  for (const pattern of patterns) {
    const matches = scriptText.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      // 过滤掉太长的文本（可能不是角色名）
      if (name.length > 0 && name.length < 10 && !/[，。！？\d]/.test(name)) {
        characters.add(name);
      }
    }
  }
  
  return Array.from(characters).slice(0, 5); // 最多返回5个主要角色
}
