export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

const MAGIC_PROMPT = `Transform this child's drawing into one realistic, believable, family-friendly image.

The drawing is the source of truth. Carefully interpret the child's marks before generating anything. Preserve the main subjects, their relative positions, approximate scale, colors when meaningful, pose/action, scene layout and important small details. Turn simple lines and scribbles into plausible real-world objects, people, animals, scenery, water, sky or structures as appropriate.

Keep the spirit and imagination of a 7-year-old's drawing. Do not over-correct the composition and do not replace the idea with a generic scene. Do not show the paper, frame, marker strokes, crayons or sketch itself in the final result. Make the final image photorealistic, warm, playful, cinematic and safe for children. If a shape is ambiguous, choose the most visually coherent interpretation from the drawing rather than adding unrelated objects.`;

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Imagem inválida.');

  const mime = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  return new Blob([bytes], { type: mime });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Método não permitido.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      message: 'O app ainda precisa da chave da IA para fazer a mágica.'
    });
  }

  try {
    const imageDataUrl = req.body?.image;
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({ message: 'Envie uma foto do desenho.' });
    }

    const imageBlob = dataUrlToBlob(imageDataUrl);
    if (imageBlob.size > 3.8 * 1024 * 1024) {
      return res.status(413).json({ message: 'A foto ficou grande demais. Tire outra foto.' });
    }

    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('image', imageBlob, 'drawing.jpg');
    form.append('prompt', MAGIC_PROMPT);
    form.append('size', 'auto');
    form.append('quality', 'medium');
    form.append('output_format', 'png');

    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const result = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('OpenAI image error:', result);
      const message = result?.error?.message || 'Não consegui transformar esse desenho agora.';
      return res.status(openaiResponse.status).json({ message });
    }

    const base64 = result?.data?.[0]?.b64_json;
    if (!base64) {
      console.error('Unexpected image response:', result);
      return res.status(502).json({ message: 'A imagem não voltou pronta. Tente de novo.' });
    }

    return res.status(200).json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'A mágica tropeçou. Tente mais uma vez.' });
  }
}
