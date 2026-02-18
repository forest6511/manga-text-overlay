#!/usr/bin/env node
/**
 * シンプルな画像生成スクリプト
 * 任意のプロンプトで画像を生成
 */
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { checkUsage, recordUsage } from "./usage_guard.mjs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY 環境変数を設定してください");
  process.exit(1);
}

const prompt = process.argv[2] || "A romantic book cover with warm colors";

async function main() {
  checkUsage();
  const genAI = new GoogleGenAI({ apiKey });

  console.log(`プロンプト: ${prompt}`);
  console.log("生成中...");

  const response = await genAI.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
  });

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        console.log("説明:", part.text);
      }
      if (part.inlineData?.data) {
        const timestamp = Date.now();
        const dir = path.join(process.cwd(), "generated_imgs");
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `image_${timestamp}.png`);
        fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
        console.log("保存:", filePath);
        recordUsage();
      }
    }
  }
}

main().catch(console.error);
