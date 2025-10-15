import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Classifying object from image...");

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
            content: "You are an expert at analyzing images and classifying objects. Classify the main object in the image as one of: character (人物/角色), prop (道具/物品), or scene (场景/背景). Only respond with one word: 'character', 'prop', or 'scene'."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What is the main object in this image? Respond with only one word: 'character', 'prop', or 'scene'."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const classification = data.choices?.[0]?.message?.content?.trim().toLowerCase();
    
    console.log("Classification result:", classification);

    // Validate and normalize the classification
    let elementType: 'character' | 'prop' | 'scene' = 'prop';
    if (classification?.includes('character')) {
      elementType = 'character';
    } else if (classification?.includes('scene')) {
      elementType = 'scene';
    }

    return new Response(
      JSON.stringify({ elementType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in classify-object function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
