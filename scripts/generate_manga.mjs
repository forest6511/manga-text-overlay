#!/usr/bin/env node
/**
 * 4コマ漫画自動生成スクリプト
 * 1. Geminiで吹き出し空白の画像を生成
 * 2. node-canvasで日本語テキストをオーバーレイ
 */
import { GoogleGenAI } from "@google/genai";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY 環境変数を設定してください");
  console.error("   export GEMINI_API_KEY='your-api-key'");
  process.exit(1);
}

// テーマ別のセリフ設定
const themeConfigs = {
  "吊り橋効果": {
    prompt: `A young man and woman on a suspension bridge.
Panel 1: Both on a swaying bridge, girl looks nervous
Panel 2: Boy reassures girl with confident expression
Panel 3: Girl's heart is pounding, blushing face
Panel 4: Comedic punchline scene`,
    panels: [
      { dialogues: [{ text: "この橋、すごく揺れるね...", x: 0.5, y: 0.12 }] },
      { dialogues: [{ text: "大丈夫、僕がいるから", x: 0.5, y: 0.37 }] },
      { dialogues: [
        { text: "ドキドキする...", x: 0.3, y: 0.62 },
        { text: "(これが恋...?)", x: 0.7, y: 0.62, speaker: "thought" }
      ]},
      { dialogues: [{ text: "それ、吊り橋効果だよ", x: 0.5, y: 0.87, speaker: "narrator" }] }
    ]
  },
  "返報性の法則": {
    prompt: `A young man gives a gift to a young woman.
Panel 1: Boy gives a small gift to girl
Panel 2: Girl is surprised and happy
Panel 3: Girl thinks "I should give something back..."
Panel 4: Girl gives an even bigger gift back, boy is shocked`,
    panels: [
      { dialogues: [{ text: "これ、よかったら...", x: 0.5, y: 0.12 }] },
      { dialogues: [{ text: "えっ、私に!?", x: 0.5, y: 0.37 }] },
      { dialogues: [
        { text: "お返ししなきゃ...", x: 0.3, y: 0.62 },
        { text: "(何がいいかな)", x: 0.7, y: 0.62, speaker: "thought" }
      ]},
      { dialogues: [{ text: "これが返報性の法則！", x: 0.5, y: 0.87, speaker: "narrator" }] }
    ]
  },
  "単純接触効果": {
    prompt: `A young man and woman who keep running into each other.
Panel 1: They bump into each other at a coffee shop
Panel 2: They meet again at a bookstore, both surprised
Panel 3: Third meeting at a park, girl starts to smile
Panel 4: Girl realizes she looks forward to seeing him`,
    panels: [
      { dialogues: [{ text: "あ、すみません", x: 0.5, y: 0.12 }] },
      { dialogues: [{ text: "また会いましたね", x: 0.5, y: 0.37 }] },
      { dialogues: [
        { text: "最近よく会うね", x: 0.3, y: 0.62 },
        { text: "(なんか嬉しい...)", x: 0.7, y: 0.62, speaker: "thought" }
      ]},
      { dialogues: [{ text: "単純接触効果発動！", x: 0.5, y: 0.87, speaker: "narrator" }] }
    ]
  },
  "ミラーリング": {
    prompt: `A young man and woman at a cafe, mirroring each other's gestures.
Panel 1: Both sitting at cafe, boy touches his hair
Panel 2: Girl unconsciously touches her hair too
Panel 3: Boy notices and smiles knowingly
Panel 4: They realize they're in sync`,
    panels: [
      { dialogues: [{ text: "今日は暑いね", x: 0.5, y: 0.12 }] },
      { dialogues: [{ text: "そうだね...", x: 0.5, y: 0.37 }] },
      { dialogues: [
        { text: "あれ？同じ動き...", x: 0.3, y: 0.62 },
        { text: "(無意識に真似してる)", x: 0.7, y: 0.62, speaker: "thought" }
      ]},
      { dialogues: [{ text: "ミラーリング成功♪", x: 0.5, y: 0.87, speaker: "narrator" }] }
    ]
  }
};

// デフォルト設定
const defaultConfig = themeConfigs["吊り橋効果"];

async function generateBaseImage(genAI, theme, scenePrompt) {
  console.log("🎨 吹き出しなしの4コマ漫画を生成中...");

  const prompt = `Create a 4-panel vertical manga (4コマ漫画) about "${theme}".

CRITICAL REQUIREMENTS:
- Vertical layout with 4 panels stacked
- Japanese manga art style, cute characters
- ${scenePrompt}

VERY IMPORTANT:
- Do NOT include any speech bubbles at all
- No text bubbles, no thought bubbles, no dialogue boxes
- Characters should have expressive faces and body language
- Leave space near characters' heads for speech bubbles to be added later
- Clean backgrounds without any text or bubbles`;

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
  throw new Error("画像生成に失敗しました");
}

async function overlayJapaneseText(imageBuffer, config) {
  console.log("✍️ 吹き出しと日本語テキストを追加中...");

  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // ベース画像を描画
  ctx.drawImage(image, 0, 0);

  for (const panel of config.panels) {
    for (const dialogue of panel.dialogues) {
      const x = dialogue.x * image.width;
      const y = dialogue.y * image.height;

      // フォントサイズ（画像幅に応じて調整）
      const fontSize = Math.floor(image.width / 28);

      // フォント設定
      const isThought = dialogue.speaker?.includes('thought');
      const isNarrator = dialogue.speaker === 'narrator';

      ctx.font = `${isNarrator ? 'bold ' : ''}${fontSize}px "Hiragino Kaku Gothic Pro", "Yu Gothic", "Noto Sans CJK JP", sans-serif`;

      // テキストサイズを計測
      const metrics = ctx.measureText(dialogue.text);
      const textWidth = metrics.width;
      const textHeight = fontSize;
      const paddingX = 20;
      const paddingY = 15;
      const bubbleWidth = textWidth + paddingX * 2;
      const bubbleHeight = textHeight + paddingY * 2;

      // 吹き出しを描画
      ctx.save();

      if (isNarrator) {
        // ナレーター: 角丸四角形
        drawRoundedRect(ctx, x - bubbleWidth/2, y - bubbleHeight/2, bubbleWidth, bubbleHeight, 8);
        ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isThought) {
        // 思考: 雲形吹き出し
        drawThoughtBubble(ctx, x, y, bubbleWidth, bubbleHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // 通常セリフ: 楕円吹き出し + しっぽ
        drawSpeechBubble(ctx, x, y, bubbleWidth, bubbleHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();

      // テキスト描画
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isNarrator ? '#FFFFFF' : '#000000';
      ctx.fillText(dialogue.text, x, y);
    }
  }

  return canvas.toBuffer('image/png');
}

// 角丸四角形を描画
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 通常の吹き出し（楕円 + しっぽ）
function drawSpeechBubble(ctx, x, y, width, height) {
  ctx.beginPath();
  // 楕円部分
  ctx.ellipse(x, y, width/2, height/2, 0, 0, Math.PI * 2);
  ctx.closePath();

  // しっぽ部分
  ctx.moveTo(x + width * 0.1, y + height/2 - 5);
  ctx.lineTo(x + width * 0.2, y + height/2 + 15);
  ctx.lineTo(x - width * 0.05, y + height/2 - 2);
}

// 思考吹き出し（雲形）
function drawThoughtBubble(ctx, x, y, width, height) {
  ctx.beginPath();
  // メインの雲
  ctx.ellipse(x, y, width/2, height/2, 0, 0, Math.PI * 2);
  ctx.closePath();

  // 小さい泡（しっぽの代わり）
  ctx.moveTo(x + width * 0.3, y + height/2 + 8);
  ctx.arc(x + width * 0.25, y + height/2 + 12, 5, 0, Math.PI * 2);
  ctx.moveTo(x + width * 0.35, y + height/2 + 20);
  ctx.arc(x + width * 0.32, y + height/2 + 22, 3, 0, Math.PI * 2);
}

async function main() {
  const themeKey = process.argv[2] || "吊り橋効果";

  // テーマ設定を取得（なければデフォルト）
  const config = themeConfigs[themeKey] || defaultConfig;
  const theme = themeKey;

  console.log(`📖 テーマ: ${theme}`);
  console.log(`📝 コマ数: ${config.panels.length}`);
  console.log(`🎭 利用可能テーマ: ${Object.keys(themeConfigs).join(", ")}`);

  const genAI = new GoogleGenAI({ apiKey });

  // Step 1: 吹き出し空白の画像を生成
  const baseImageBuffer = await generateBaseImage(genAI, theme, config.prompt);

  // 中間ファイル保存（デバッグ用）
  const timestamp = Date.now();
  const dir = path.join(process.cwd(), "generated_imgs");
  fs.mkdirSync(dir, { recursive: true });

  const baseImagePath = path.join(dir, `manga_base_${timestamp}.png`);
  fs.writeFileSync(baseImagePath, baseImageBuffer);
  console.log(`💾 ベース画像: ${baseImagePath}`);

  // Step 2: 日本語テキストをオーバーレイ
  const finalImageBuffer = await overlayJapaneseText(baseImageBuffer, config);

  const finalImagePath = path.join(dir, `manga_final_${timestamp}.png`);
  fs.writeFileSync(finalImagePath, finalImageBuffer);
  console.log(`✅ 完成: ${finalImagePath}`);
}

main().catch(console.error);
