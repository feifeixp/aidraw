import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 风格配置映射
const styleConfigs: Record<string, { description: string; background: string }> = {
  auto: {
    description: '',  // 自动风格不指定，让AI根据参考图片决定
    background: ''
  },
  blackWhiteSketch: {
    description: '黑白线稿风格，简洁的手绘线条，白色背景',
    background: '白色背景'
  },
  blackWhiteComic: {
    description: '黑白漫画风格，有明暗对比和阴影，经典漫画质感',
    background: '白色或灰色背景'
  },
  japaneseAnime: {
    description: '日式动漫风格，清晰的轮廓线，赛璐璐上色，明亮色彩',
    background: '简洁背景'
  },
  americanComic: {
    description: '美式漫画风格，粗犷的线条，强烈的明暗对比，动感十足',
    background: '戏剧性背景'
  },
  chineseAnime: {
    description: '国风动漫风格，水墨韵味，传统美学，柔和色彩',
    background: '中国风背景元素'
  },
  '3dCartoon': {
    description: '3D卡通风格，类似皮克斯动画，圆润可爱，色彩鲜艳',
    background: '3D场景背景'
  },
  '3dUnreal': {
    description: '虚幻引擎风格，高质量3D渲染，真实光影效果，精细材质',
    background: '逼真场景'
  },
  cinematic: {
    description: '电影写实风格，真实摄影感，电影级光影，细腻质感',
    background: '真实场景环境'
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scriptText, referenceImages, style = 'auto' } = await req.json();

    if (!scriptText || typeof scriptText !== 'string') {
      return new Response(
        JSON.stringify({ error: '剧本文本不能为空' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (referenceImages && (!Array.isArray(referenceImages) || referenceImages.length > 4)) {
      return new Response(
        JSON.stringify({ error: '最多只能上传4张参考图片' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('开始生成AI分镜，剧本长度:', scriptText.length, '参考图片数量:', referenceImages.length, '风格:', style);

    // 分析剧本，将其分割成多个场景
    const scenes = analyzeScriptScenes(scriptText);
    console.log('分析出场景数:', scenes.length);

    const generatedImages: string[] = [];

    // 为每个场景生成分镜
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`生成第 ${i + 1}/${scenes.length} 个场景分镜...`);

      // 构建提示词（包含风格信息，传入是否有参考图片）
      const prompt = buildStoryboardPrompt(scene, scriptText, style, referenceImages && referenceImages.length > 0);

      // 构建消息内容
      const content: any[] = [
        { type: "text", text: prompt }
      ];

      // 添加参考图片（如果有）
      if (referenceImages && referenceImages.length > 0) {
        for (const imageUrl of referenceImages) {
          content.push({
            type: "image_url",
            image_url: { url: imageUrl }
          });
        }
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
  
  // 按照换行分割剧本
  const lines = scriptText.split(/\n+/);
  let currentScene = '';
  let sceneHeader = ''; // 保存场景、人物、时间等信息
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    // 检测场景标记（如：场景1、镜头1、Scene 1、△等）
    const isSceneMarker = /^(场景|镜头|分镜|Scene|Shot)\s*\d+/i.test(trimmedLine);
    const isShotMarker = trimmedLine.startsWith('△'); // 分镜标记
    const isMetaInfo = trimmedLine.startsWith('场景：') || 
                       trimmedLine.startsWith('人物：') || 
                       trimmedLine.startsWith('时间：');
    
    // 保存场景头信息（场景、人物、时间）
    if (isMetaInfo) {
      sceneHeader += (sceneHeader ? ' ' : '') + trimmedLine;
      continue;
    }
    
    // 遇到镜头标记（△）或场景标记时，如果已有内容则保存当前场景
    if ((isShotMarker || isSceneMarker) && currentScene) {
      // 将场景头信息加入到每个镜头
      const fullScene = sceneHeader ? `${sceneHeader} ${currentScene}` : currentScene;
      scenes.push(fullScene.trim());
      currentScene = trimmedLine;
    } else if (isShotMarker) {
      // 新的镜头开始
      currentScene = trimmedLine;
    } else {
      // 累积到当前场景
      currentScene += (currentScene ? ' ' : '') + trimmedLine;
      
      // 如果当前场景太长（超过300字），自动分割
      if (currentScene.length > 300) {
        const fullScene = sceneHeader ? `${sceneHeader} ${currentScene}` : currentScene;
        scenes.push(fullScene.trim());
        currentScene = '';
      }
    }
  }
  
  // 添加最后一个场景
  if (currentScene.trim()) {
    const fullScene = sceneHeader ? `${sceneHeader} ${currentScene}` : currentScene;
    scenes.push(fullScene.trim());
  }
  
  // 如果没有明确的场景分割，尝试按对话和描述分割
  if (scenes.length === 0 || scenes.length === 1) {
    // 按双换行符分段
    const paragraphs = scriptText.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length > 1) {
      return paragraphs.slice(0, 8);
    }
    
    // 如果还是只有一个场景，尝试按△符号分割
    const shotMarkerSplit = scriptText.split(/△/).filter(s => s.trim());
    if (shotMarkerSplit.length > 1) {
      // 保留场景头信息
      const header = shotMarkerSplit[0];
      return shotMarkerSplit.slice(1).map((shot, i) => {
        return i === 0 ? `${header} △${shot}` : `${header.split(/\n/)[0]} △${shot}`;
      }).slice(0, 8);
    }
  }
  
  // 最多生成8个场景
  return scenes.slice(0, 8);
}

// 构建分镜生成提示词（根据风格）
function buildStoryboardPrompt(sceneText: string, fullScript: string, style: string, hasReferenceImages: boolean): string {
  // 从完整剧本中识别角色
  const characters = extractCharacters(fullScript);
  const charactersText = characters.length > 0 
    ? `主要角色：${characters.join('、')}` 
    : '';
  
  // 获取风格配置
  const styleConfig = styleConfigs[style] || {
    description: style, // 自定义风格直接使用用户输入
    background: '适合的背景'
  };
  
  // 构建风格要求部分
  let styleRequirements = '';
  if (style === 'auto' && hasReferenceImages) {
    // 自动风格且有参考图：让AI根据参考图片决定风格
    styleRequirements = `艺术风格要求：
参考提供的参考图片中的绘画风格、色彩运用和表现手法，生成与参考图风格一致的分镜画面。`;
  } else if (style === 'auto' && !hasReferenceImages) {
    // 自动风格但无参考图：使用默认风格
    styleRequirements = `艺术风格要求：
使用清晰简洁的黑白线稿风格，线条流畅，构图清晰。`;
  } else if (styleConfig.description) {
    // 指定风格
    styleRequirements = `艺术风格要求：
${styleConfig.description}
${styleConfig.background}`;
  }
  
  // 构建角色相关要求
  const characterRequirements = hasReferenceImages 
    ? '3. 保持参考图中的角色造型和特征'
    : '3. 根据剧本描述创作角色形象';
  
  return `为以下场景生成一张独立的分镜画面：

${sceneText}

${charactersText}

${styleRequirements}

重要要求：
1. 这是单个独立的分镜画面，不要在一张图中包含多个分镜格子或面板
2. 只显示这一个场景的画面内容
${characterRequirements}
${hasReferenceImages 
  ? (style === 'auto' ? '4. 严格参考提供的参考图片风格' : '4. 严格按照上述风格要求生成') 
  : '4. 严格按照上述风格要求生成'}
5. 构图要完整，适合作为独立的分镜使用

请直接生成一张完整的分镜图片，不要输出文字描述。`;
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
