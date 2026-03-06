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
- **模擬商談（高度）**: `/negotiation` で以下を利用可能。
  - **難易度**: 易・標準・難（AIの態度が協力的〜厳しめに変化）
  - **音声入力**: マイクで発話して送信
  - **経過タイマー**: 商談時間を表示
  - **構造化フィードバック**: 終了時に良かった点・改善点・アドバイス・総合評価（★1〜5）を表示
  - **セッション保存**: PostgreSQL に会話ログとフィードバックを保存
  - **履歴**: 過去セッション一覧・詳細（会話ログ＋フィードバック）の閲覧

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

`src/lib/schema.sql` の内容でテーブル（conversations, messages, negotiation_sessions, negotiation_messages）が作成されます。既存環境で模擬商談の履歴保存を使う場合は、再度 `npm run db:init` を実行してください。

### 4. 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:3001 を開きます。

## Docker で動かす

PostgreSQL とアプリをまとめて起動します。

### 前提

- Docker と Docker Compose がインストールされていること
- `.env` に `OPENAI_API_KEY` を設定（チャット・模擬商談で利用）。`.env` がない場合は `copy .env.example .env` で作成してから編集する。Compose で「.env が無い」と出る場合は、空の `.env` を作成するか、`docker-compose.yml` の `env_file: - .env` を削除する。

### 起動

```bash
cd C:\devlop\AI-agent
docker compose up --build
```

- **本番アプリ（フロント＋API）**: http://localhost:3001
- **開発用フロント（ホットリロード）**: http://localhost:3002
- PostgreSQL: ホストの 5432（コンテナ内のみで使う場合は `docker-compose.yml` の `ports` を削除可）

起動時にアプリ側で PostgreSQL の起動を待ち、`src/lib/schema.sql` でテーブルを自動作成します。`app` が本番用、`frontend` が開発用（コード変更が即反映）です。

### 停止

```bash
docker compose down
```

データを消す場合: `docker compose down -v`

## Railway にデプロイする（完全公開モード）

**完全公開モード**（誰でも URL でアクセス可能）でデプロイする手順は **[RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)** を参照してください。  
1) GitHub からデプロイ → 2) **Generate Domain** で公開 URL を発行 → 3) **OPENAI_API_KEY** を Variables に設定、で利用可能になります。

## 本番ビルド

```bash
npm run build
npm start
```

## API 制限・運用

- **ヘルスチェック**: `GET /api/health` で稼働状態を確認できます。  
  - `openai`: OPENAI_API_KEY が設定されているか  
  - `db`: PostgreSQL に接続できるか  
  - `status` が `ok` で 200、未設定時は `degraded` で 503 を返します。
- **リクエスト制限**: チャット・模擬商談のメッセージ数・1メッセージの文字数などは `src/lib/constants.ts` で定義し、Zod スキーマで検証しています。不正な body は 400 で拒否されます。
- **DB 未設定時**: 会話一覧・履歴など DB を使う API は 503（Database unavailable）を返します。チャット・模擬商談の応答自体は OPENAI が有効なら利用可能です。

## Docker 関連ファイル

- `Dockerfile` … Next.js のマルチステージビルド（standalone）
- `docker-compose.yml` … アプリ + PostgreSQL
- `scripts/docker-entrypoint.sh` … 起動時に DB 待ち・スキーマ初期化後に `next start` を実行
- `scripts/docker-init-db.mjs` … `schema.sql` を PostgreSQL に流し込む（Docker 用）

## プロジェクト構成（抜粋）

```
src/
  app/
    page.tsx              # チャットUI（音声・テキスト）
    negotiation/page.tsx  # 模擬商談UI（シナリオ・役割・チャット・フィードバック）
    api/
      chat/route.ts       # ストリーミングチャット + ツール実行
      conversations/     # 会話一覧・作成・メッセージ取得
      negotiation/       # 模擬商談チャット・フィードバックAPI
  lib/
    db.ts                 # PostgreSQL 接続
    constants.ts          # API 制限値（メッセージ数・文字数など）
    schemas.ts            # Zod によるリクエスト body 検証
    api.ts                # 共通エラーレスポンス・パースヘルパー
    schema.sql            # テーブル定義
    tools.ts              # エージェント用ツール定義・実行
    negotiation.ts        # 模擬商談シナリオ・システムプロンプト定義
  app/api/
    health/route.ts       # ヘルスチェック（OPENAI・DB 状態）
  types/
    agent.ts              # メッセージ・会話の型
```

## カスタムツールの追加

`src/lib/tools.ts` の `AGENT_TOOLS` に定義を追加し、`runTool` に case を追加すると、エージェントが新しいアクションを実行できます。

## ライセンス

MIT
"# AI-agent" 
