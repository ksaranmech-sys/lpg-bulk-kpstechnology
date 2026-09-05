// @ts-nocheck
import { handleUpload } from "@vercel/blob/client";

// Client-side uploads go through this route so large photos never pass through
// your serverless function body (Vercel functions have a payload size limit).
export default async function handler(req, res) {
  const body = req.body;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({ allowedContentTypes: ["image/jpeg", "image/png", "image/webp"] }),
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
