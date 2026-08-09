export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

const MAGIC_PROMPT = `Transform this child's drawing into one realistic, believable, family-friendly image in a horizontal landscape format.

The drawing is the source of truth. Carefully interpret the child's marks before generating anything. Preserve the main subjects, their relative positions, approximate scale, colors when meaningful, pose/action, scene layout and important small details. Turn simple lines and scribbles into plausible real-world objects, people, animals, scenery, water, sky or structures as appropriate.

The final image must always be horizontal and wide. Compose the scene to fill the entire frame edge to edge. If the source drawing is vertical or narrow, naturally expand the environment to the left and right so the composition feels complete. Do not leave blank side margins, white bars, empty canvas space or a floating subject. Keep the important subject comfortably inside the frame while using the added horizontal space to complete the scene naturally.

Keep the spirit and imagination of a 7-year-old's drawing. Do not over-correct the composition and do not replace the idea with a generic scene. Do not show the paper, frame, marker strokes, crayons or sketch itself in the final result. Make the final image photorealistic, warm, playful, cinematic and safe for children. If a shape is ambiguous, choose the most visually coherent interpretation from the drawing rather than adding unrelated objects.`;

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Imagem inválida.');

  const mime = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  return new Blob([bytes], { type: mime });
}

function toChildFriendlyMessage(status, result) {
  const apiMessage = String(result?.error?.message || '').toLowerCase();
  const apiCode = String(result?.error?.code || '').toLowerCase();
  const apiType = String(result?.error?.type || '').toLowerCase();

  if (
    status === 402 ||
    apiCode.includes('insufficient_quota') ||
    apiType.includes('insufficient_quota') ||
    apiMessage.includes('no credits remaining') ||
    apiMessage.includes('insufficient_quota') ||
    apiMessage.includes('billing') ||
    apiMessage.includes('quota')
  ) {
    return 'A mágica ficou sem energia. Peça para um adulto ajudar e tente de novo.';
  }

  if (status === 401 || status === 403) {
    return 'A mágica não conseguiu abrir o baú secreto. Peça para um adulto verificar e tente de novo.';
  }

  if (status === 413) {
    return 'A foto ficou grande demais. Tire outra foto.';
  }

  if (status === 429) {
    return 'Tem muita gente usando a mágica agora. Espere um pouquinho e tente de novo.';
  }

  if (status >= 500) {
    return 'A mágica tropeçou. Tente mais uma vez.';
  }

  return 'Não consegui transformar esse desenho agora. Tente de novo.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Método não permitido.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      message: 'A mágica ainda não está pronta. Peça para um adulto ajudar.'
    });
  }

  try {
    const imageDataUrl = req.body?.image;
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({ message: 'Envie uma foto do desenho.' });
    }

    const imageBlob = dataUrlToBlob(imageDataUrl);
    if (imageBlob.size > 3.2 * 1024 * 1024) {
      return res.status(413).json({ message: 'A foto ficou grande demais. Tire outra foto.' });
    }

    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('image', imageBlob, 'drawing.jpg');
    form.append('prompt', MAGIC_PROMPT);
    form.append('size', '1536x1024');
    form.append('quality', 'medium');
    form.append('output_format', 'webp');
    form.append('output_compression', '82');

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
      return res.status(openaiResponse.status).json({
        message: toChildFriendlyMessage(openaiResponse.status, result)
      });
    }

    const base64 = result?.data?.[0]?.b64_json;
    if (!base64) {
      console.error('Unexpected image response:', result);
      return res.status(502).json({ message: 'A imagem não voltou pronta. Tente de novo.' });
    }

    return res.status(200).json({ image: `data:image/webp;base64,${base64}` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'A mágica tropeçou. Tente mais uma vez.' });
  }
}
