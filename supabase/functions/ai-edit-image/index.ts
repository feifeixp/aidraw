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
    const { imageUrl, instruction, referenceImageUrl } = await req.json();
    
    if (!imageUrl || !instruction) {
      throw new Error('Missing required fields: imageUrl and instruction');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Editing image with instruction:', instruction);
    if (referenceImageUrl) {
      console.log('Using reference image for pose');
    }

    // Build content array with images
    const content: any[] = [
      {
        type: 'text',
        text: instruction
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      }
    ];

    // Add reference image if provided
    if (referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: referenceImageUrl
        }
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!editedImageUrl) {
      throw new Error('No image returned from AI');
    }

    console.log('Image edited successfully');

    return new Response(
      JSON.stringify({ imageUrl: editedImageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-edit-image:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
