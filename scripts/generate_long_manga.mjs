#!/usr/bin/env node
/**
 * 長編恋愛指南漫画生成スクリプト
 * 6コマ以上対応
 */
import { GoogleGenAI } from "@google/genai";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import { checkUsage, recordUsage } from "./usage_guard.mjs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY 環境変数を設定してください");
  process.exit(1);
}

// 恋愛心理学テーマ集
const themes = {
  "ミラーリング": {
    panels: 6,
    prompt: `A 6-panel manga (2 columns x 3 rows) about mirroring technique in romance.
- Panel 1: A man and woman at a cafe, sitting across from each other
- Panel 2: Man touches his chin thoughtfully
- Panel 3: Woman unconsciously touches her chin too
- Panel 4: Man notices and smiles slightly
- Panel 5: They both reach for their coffee cups at the same time
- Panel 6: Both laughing, clearly connected`,
    dialogues: [
      { text: "今日はありがとう", x: 0.25, y: 0.12 },
      { text: "うん...", x: 0.75, y: 0.12 },
      { text: "（あれ？同じ動き...）", x: 0.25, y: 0.45, style: "thought" },
      { text: "気が合うね", x: 0.75, y: 0.45 },
      { text: "あっ", x: 0.25, y: 0.78 },
      { text: "ミラーリング成功♪", x: 0.75, y: 0.78, style: "narrator" },
    ]
  },
  "単純接触効果": {
    panels: 6,
    prompt: `A 6-panel manga (2 columns x 3 rows) about mere exposure effect.
- Panel 1: Man and woman bump into each other at a bookstore
- Panel 2: They meet again at a coffee shop, surprised
- Panel 3: Third meeting at a park, both smile
- Panel 4: Fourth meeting at a train station
- Panel 5: Woman realizes she's looking forward to seeing him
- Panel 6: They exchange contact info, both happy`,
    dialogues: [
      { text: "あ、すみません", x: 0.25, y: 0.12 },
      { text: "また会いましたね", x: 0.75, y: 0.12 },
      { text: "運命かも？", x: 0.25, y: 0.45 },
      { text: "今日も会えた...", x: 0.75, y: 0.45 },
      { text: "（会いたいな...）", x: 0.25, y: 0.78, style: "thought" },
      { text: "単純接触効果！", x: 0.75, y: 0.78, style: "narrator" },
    ]
  },
  "好意の返報性": {
    panels: 6,
    prompt: `A 6-panel manga (2 columns x 3 rows) about reciprocity of liking.
- Panel 1: Woman gives a small handmade gift to man
- Panel 2: Man is surprised and touched
- Panel 3: Man thinks about what to give back
- Panel 4: Man prepares a thoughtful gift
- Panel 5: Man gives gift, woman is delighted
- Panel 6: Both exchanging warm smiles`,
    dialogues: [
      { text: "これ、作ったの", x: 0.25, y: 0.12 },
      { text: "え、僕に!?", x: 0.75, y: 0.12 },
      { text: "（お返し何がいい...）", x: 0.25, y: 0.45, style: "thought" },
      { text: "喜んでくれるかな", x: 0.75, y: 0.45 },
      { text: "ありがとう！", x: 0.25, y: 0.78 },
      { text: "好意の返報性♪", x: 0.75, y: 0.78, style: "narrator" },
    ]
  },
  "ゲインロス効果": {
    panels: 8,
    prompt: `An 8-panel manga (2 columns x 4 rows) about gain-loss effect in attraction.
- Panel 1: Man seems cold and distant to woman at first meeting
- Panel 2: Woman feels discouraged
- Panel 3: Second meeting, man is slightly warmer
- Panel 4: Woman notices the change
- Panel 5: Third meeting, man smiles and is friendly
- Panel 6: Woman's heart races at the contrast
- Panel 7: Man compliments woman genuinely
- Panel 8: Woman is completely charmed by the change`,
    dialogues: [
      { text: "...", x: 0.25, y: 0.08 },
      { text: "（冷たい人...）", x: 0.75, y: 0.08, style: "thought" },
      { text: "やあ", x: 0.25, y: 0.32 },
      { text: "（あれ？優しい？）", x: 0.75, y: 0.32, style: "thought" },
      { text: "会えて嬉しい", x: 0.25, y: 0.57 },
      { text: "ドキッ！", x: 0.75, y: 0.57 },
      { text: "君は特別だね", x: 0.25, y: 0.82 },
      { text: "ゲインロス効果！", x: 0.75, y: 0.82, style: "narrator" },
    ]
  },
};

async function generateBaseImage(genAI, theme, config) {
  console.log(`🎨 ${config.panels}コマ漫画を生成中...`);

  const prompt = `Create a ${config.panels}-panel manga about "${theme}" (恋愛心理学).

LAYOUT: ${config.panels <= 6 ? '2 columns x 3 rows' : '2 columns x 4 rows'}
STYLE: Cute Japanese manga style, expressive characters, clean art

SCENE DESCRIPTION:
${config.prompt}

CRITICAL:
- NO speech bubbles
- NO text anywhere
- Leave space near characters for text to be added later
- Clean backgrounds`;

  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }
  }
  throw new Error("画像生成失敗");
}

async function addDialogues(imageBuffer, dialogues) {
  console.log("✍️ 吹き出しと日本語を追加中...");

  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);

  const fontSize = Math.floor(image.width / 32);

  for (const d of dialogues) {
    const x = d.x * image.width;
    const y = d.y * image.height;

    ctx.font = `${d.style === 'narrator' ? 'bold ' : ''}${fontSize}px "Hiragino Kaku Gothic Pro", "Yu Gothic", "Noto Sans CJK JP", sans-serif`;

    const metrics = ctx.measureText(d.text);
    const padding = 12;
    const bubbleWidth = metrics.width + padding * 2;
    const bubbleHeight = fontSize + padding * 2;

    // 吹き出し描画
    ctx.beginPath();
    if (d.style === 'narrator') {
      // ナレーター: 角丸四角
      roundRect(ctx, x - bubbleWidth/2, y - bubbleHeight/2, bubbleWidth, bubbleHeight, 6);
      ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
      ctx.fill();
      ctx.strokeStyle = '#222';
    } else if (d.style === 'thought') {
      // 思考: 雲形
      ctx.ellipse(x, y, bubbleWidth/2, bubbleHeight/2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#888';
    } else {
      // 通常セリフ
      ctx.ellipse(x, y, bubbleWidth/2, bubbleHeight/2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#333';
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // テキスト
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = d.style === 'narrator' ? '#FFF' : (d.style === 'thought' ? '#555' : '#000');
    ctx.fillText(d.text, x, y);
  }

  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function main() {
  const themeName = process.argv[2] || "ミラーリング";
  const config = themes[themeName];

  if (!config) {
    console.log("❌ テーマが見つかりません");
    console.log("利用可能なテーマ:", Object.keys(themes).join(", "));
    process.exit(1);
  }

  console.log(`📖 テーマ: ${themeName}`);
  console.log(`📝 コマ数: ${config.panels}`);

  checkUsage();
  const genAI = new GoogleGenAI({ apiKey });

  const baseBuffer = await generateBaseImage(genAI, themeName, config);

  const timestamp = Date.now();
  const dir = path.join(process.cwd(), "generated_imgs");
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, `long_base_${timestamp}.png`), baseBuffer);
  console.log(`💾 ベース画像保存`);
  recordUsage();

  const finalBuffer = await addDialogues(baseBuffer, config.dialogues);
  const finalPath = path.join(dir, `long_final_${timestamp}.png`);
  fs.writeFileSync(finalPath, finalBuffer);
  console.log(`✅ 完成: ${finalPath}`);
}

main().catch(console.error);
