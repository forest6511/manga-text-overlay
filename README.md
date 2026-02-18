# Manga Text Overlay

Gemini AI画像生成における日本語テキスト文字化け問題を解決するNode.jsツール。

## 問題

Gemini (Nano Banana Flash) で漫画を生成すると、日本語テキストが文字化け（中国語風の文字、読めない記号）になる問題があります。

**Flash モデルで生成（文字化けあり）:**

![文字化けの例](docs/before.png)

**このツールで解決（Flash + node-canvas オーバーレイ）:**

![解決後](docs/after.png)

## Nano Banana Pro なら日本語が正確

**Gemini Pro（`gemini-3-pro-image-preview`）は、プロンプトに日本語を含めるだけで吹き出し内の日本語が正確に描画されます。** 後処理のオーバーレイは不要です。

![Pro モデルの出力例](docs/pro_japanese.png)

| モデル | 日本語精度 | 後処理 | コスト |
|--------|-----------|--------|--------|
| Flash (`gemini-2.5-flash-image`) | 文字化けする | オーバーレイ必須 | 無料枠あり |
| **Pro** (`gemini-3-pro-image-preview`) | **正確** | **不要** | 約¥20/枚 |

本を作るなど品質が重要な場合は Pro モデルの使用を推奨します。

## インストール

```bash
git clone https://github.com/YOUR_USERNAME/manga-text-overlay.git
cd manga-text-overlay
npm install
```

## 環境設定

```bash
export GEMINI_API_KEY="your-api-key-here"
```

または `.env` ファイルに記載（`.gitignore` 対象）:

```
GEMINI_API_KEY=your-api-key-here
```

## 使い方

### 基本的な4コマ漫画生成

```bash
GEMINI_API_KEY=your-key node scripts/generate_manga.mjs "吊り橋効果"
```

**利用可能なテーマ:**
- 吊り橋効果
- 返報性の法則
- 単純接触効果
- ミラーリング

### 長編漫画（6〜8コマ）

```bash
GEMINI_API_KEY=your-key node scripts/generate_long_manga.mjs "ミラーリング"
```

**利用可能なテーマ:**
- ミラーリング（6コマ）
- 単純接触効果（6コマ）
- 好意の返報性（6コマ）
- ゲインロス効果（8コマ）

### シンプルな画像生成

```bash
GEMINI_API_KEY=your-key node scripts/generate_image.mjs "プロンプト"
```

### 出力

生成された画像は `generated_imgs/` ディレクトリに保存されます：
- `manga_base_[timestamp].png` - テキストなしのベース画像
- `manga_final_[timestamp].png` - テキスト追加済みの完成画像

## 使用量ガード

月間の画像生成回数を制限して予算超過を防止する仕組みが組み込まれています。

- 月間上限: 50枚（¥1,000 / ¥20/枚）
- 上限到達時はスクリプトが自動停止
- カウントは毎月1日にリセット

```
📊 今月の使用量: 3/50枚 (残り47枚)
```

## カスタマイズ

### 新しいテーマを追加

`scripts/generate_long_manga.mjs` の `themes` オブジェクトに追加：

```javascript
const themes = {
  "新しいテーマ": {
    panels: 6,  // コマ数
    prompt: `シーンの説明...`,
    dialogues: [
      { text: "セリフ1", x: 0.25, y: 0.12 },
      { text: "セリフ2", x: 0.75, y: 0.12 },
      // ...
    ]
  }
};
```

### 座標システム

- `x`: 横位置（0.0 = 左端、1.0 = 右端）
- `y`: 縦位置（0.0 = 上端、1.0 = 下端）

### 吹き出しスタイル

```javascript
{ text: "通常のセリフ", x: 0.5, y: 0.5 }
{ text: "（心の声）", x: 0.5, y: 0.5, style: "thought" }
{ text: "ナレーション", x: 0.5, y: 0.5, style: "narrator" }
```

## 技術詳細

### なぜ文字化けするのか

1. **学習データの偏り**: AIは主に英語データで学習されており、日本語（ひらがな46+カタカナ46+漢字数千）の学習データが少ない
2. **文字を「形」として描画**: 文字の「意味」ではなく「線と形」として描画するため、画数の多い漢字は潰れやすい
3. **中国語データの影響**: 学習データの漢字が中国語寄りのため、中華フォント風になりやすい

### 解決アプローチの比較

| 方法 | 日本語精度 | 自動化 | コスト |
|------|-----------|--------|--------|
| Flash + プロンプト工夫 | △ 不安定 | ○ | 無料枠あり |
| Flash + Inpainting | △ 不安定 | ○ | 無料枠あり |
| **Flash + オーバーレイ（本ツール）** | **◎ 確実** | **◎** | **無料枠あり** |
| **Pro モデル直接生成** | **◎ 確実** | **◎** | **約¥20/枚** |

### 使用技術

- **Gemini API** (`@google/genai`): 画像生成
- **node-canvas**: テキストオーバーレイ、吹き出し描画
- **Node.js ES Modules**: モダンなJavaScript

## ファイル構成

```
manga-text-overlay/
├── README.md
├── package.json
├── .env                        # APIキー（.gitignore対象）
├── scripts/
│   ├── generate_manga.mjs      # 4コマ漫画生成（Pro）
│   ├── generate_long_manga.mjs # 6〜8コマ漫画生成（Flash）
│   ├── generate_image.mjs      # シンプルな画像生成（Pro）
│   └── usage_guard.mjs         # 月間使用量ガード
├── generated_imgs/             # 生成画像の出力先
└── docs/
    ├── before.png              # Flash 文字化けの例
    ├── after.png               # Flash + オーバーレイの例
    └── pro_japanese.png        # Pro モデルの出力例
```

## 必要要件

- Node.js 18+
- Gemini API キー（Google AI Studio で取得）
- macOS（Hiragino フォント使用）または日本語フォントがインストールされた環境

## ライセンス

MIT

## 参考資料

- [Gemini API ドキュメント](https://ai.google.dev/gemini-api/docs)
