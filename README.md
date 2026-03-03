# AI Agent

Next.js + TypeScript + React + PostgreSQL による、**音声会話・テキスト入力・アクション**ができるリアルタイム AI エージェントです。

## 技術スタック

- **Next.js 14** (App Router) + **TypeScript** + **React 18**
- **PostgreSQL**（会話・メッセージの永続化）
- **OpenAI API**（ストリーミング応答・ツール呼び出し）
- ブラウザ **Web Speech API**（音声入力）

## 機能

- **テキストチャット**: 入力して送信、ストリーミングで応答表示
- **音声入力**: マイクボタンで話すとテキストに変換され送信
- **ツール実行**: 時刻取得・計算などエージェントがアクションを実行
- **会話の永続化**: PostgreSQL に会話とメッセージを保存（任意）

## セットアップ

### 1. 依存関係のインストール

```bash
cd C:\devlop\AI-agent
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env` を作成し、値を設定します。

```bash
copy .env.example .env
```

必須:

- `OPENAI_API_KEY` … OpenAI API キー
- `DATABASE_URL` または `DB_*` … PostgreSQL 接続情報

### 3. データベースの初期化

PostgreSQL を起動した状態で:

```bash
npm run db:init
```

`src/lib/schema.sql` の内容でテーブル（conversations, messages）が作成されます。

### 4. 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## 本番ビルド

```bash
npm run build
npm start
```

## プロジェクト構成（抜粋）

```
src/
  app/
    page.tsx          # チャットUI（音声・テキスト）
    api/
      chat/route.ts   # ストリーミングチャット + ツール実行
      conversations/  # 会話一覧・作成・メッセージ取得
  lib/
    db.ts             # PostgreSQL 接続
    schema.sql        # テーブル定義
    tools.ts          # エージェント用ツール定義・実行
  types/
    agent.ts          # メッセージ・会話の型
```

## カスタムツールの追加

`src/lib/tools.ts` の `AGENT_TOOLS` に定義を追加し、`runTool` に case を追加すると、エージェントが新しいアクションを実行できます。

## ライセンス

MIT
