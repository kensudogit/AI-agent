# Railway へのデプロイ手順（AI Agent）

## 完全公開モードでデプロイする（誰でも URL でアクセス可能）

以下の手順で、**インターネットから誰でもアクセスできる公開状態**でデプロイできます。

---

### ステップ 1: プロジェクト作成とリポジトリ接続

1. [Railway](https://railway.app/) にログインする。
2. **New Project** をクリックする。
3. **Deploy from GitHub repo** を選び、**AI-agent** のリポジトリを選択して接続する。  
   （リポジトリが一覧に無い場合は、GitHub 連携を許可する。）
4. 接続が完了すると、自動でビルド・デプロイが開始される。

---

### ステップ 2: 完全公開にする（ドメインを発行）

1. デプロイされた **サービス（AI-agent のサービス）** をクリックして開く。
2. 上部の **Settings** タブを開く。
3. **Networking**（または **Public Networking**）のセクションまでスクロールする。
4. **Generate Domain**（または **Create Domain**）をクリックする。  
   → Railway が `https://〇〇-production.up.railway.app` のような **公開 URL** を発行する。
5. 発行された URL をメモする。**この URL が「完全公開」のアドレス**です。認証なしで誰でもアクセスできます。

※ **Private Networking** のみの場合は外部からアクセスできません。必ず **Generate Domain** でパブリックドメインを発行してください。

---

### ステップ 3: 環境変数（OPENAI_API_KEY）を設定

1. 同じサービスで **Variables** タブを開く。
2. **+ New Variable** をクリックする。
3. 次を追加する。

   | 変数名 | 値 |
   |--------|-----|
   | `OPENAI_API_KEY` | OpenAI の API キー（`sk-...`） |
   | `OPENAI_MODEL`（任意） | `gpt-4o-mini` など |

4. 保存すると多くの場合 **自動で再デプロイ**される。されない場合は **Deployments** から **Redeploy** する。

これで **完全公開モード** かつ **OPENAI_API_KEY が利用可能**な状態になります。

---

### ステップ 4: 動作確認

1. ステップ 2 で発行した **公開 URL** をブラウザで開く。
2. トップページや **/negotiation**（模擬商談）が表示されれば成功。
3. チャットでメッセージを送り、AI が返答すれば OPENAI_API_KEY も有効です。

---

## リポジトリがルートでない場合・ビルド設定

### Root Directory

- リポジトリのルートがこの Next.js プロジェクトならそのままでよい。
- AI-agent がサブフォルダの場合は、**Settings** → **Source** の **Root Directory** にそのパス（例: `AI-agent`）を指定する。

### ビルド・起動コマンド

- リポジトリに **`railway.json`** を入れてあるので、**Build Command** は `npm run build`、**Start Command** は `npx next start` が使われる（Railway の **PORT** を自動で使用）。
- 手動で設定する場合: **Start Command** に **`npx next start`** を指定する。

---

## 3. OPENAI_API_KEY を設定する（ここで有効にする）

1. Railway のダッシュボードで、デプロイした **サービス（AI Agent のサービス）** をクリックする。
2. 上部の **Variables** タブを開く。
3. **+ New Variable** または **Add Variable** をクリックする。
4. 次を追加する。

   | 変数名 | 値 | 説明 |
   |--------|-----|------|
   | `OPENAI_API_KEY` | `sk-...`（OpenAI で発行した API キー） | **必須**。チャット・模擬商談で利用。 |
   | `OPENAI_MODEL` | `gpt-4o-mini` など | 任意。未設定時は `gpt-4o-mini`。 |

5. **Add** で保存する。
6. 変数を追加・変更すると、多くの場合 **再デプロイ** が自動で走る。走らない場合は **Deployments** から **Redeploy** する。

これで **OPENAI_API_KEY が Railway 上で利用可能**になります。コードではすでに `process.env.OPENAI_API_KEY` を参照しているため、追加のコード変更は不要です。

---

## 4. データベース（PostgreSQL）を使う場合

模擬商談の履歴や会話を保存する場合は、PostgreSQL を追加します。

1. 同じプロジェクトで **+ New** → **Database** → **PostgreSQL** を追加する。
2. 追加した **PostgreSQL** サービスを開き、**Variables** または **Connect** で接続情報を確認する。
3. **AI Agent（アプリ）** の **Variables** を開く。
4. **Add Reference** や **Connect** から、PostgreSQL の **DATABASE_URL**（または `DATABASE_URI`）を選んでアプリに追加する。  
   または、PostgreSQL の Variables に表示されている接続 URL をコピーし、アプリの Variables に **`DATABASE_URL`** という名前で貼り付ける。
5. Railway の Postgres は空なので、**初回デプロイ後にアプリの起動時**に `scripts/docker-init-db.mjs` 相当のスキーマ実行が必要です。  
   - ローカルで `npm run db:init` を実行する代わりに、**Railway の「One-off command」や「Deploy Hooks」** で DB 初期化用のコマンドを実行する方法もあります。  
   - または、アプリ側で「DB にテーブルが無いときだけスキーマを実行する」処理を入れておく（Docker 用の `docker-init-db.mjs` と同様のロジックを起動時に実行する）と、Railway でも初回から使えます。

---

## 502 Bad Gateway が出る場合

ブラウザで **502 Bad Gateway** や「message port closed」が出るときは、次の順で確認してください。

1. **起動ポート**
   - **Start Command** は **`npx next start`** のままにし、**`-p 3001` などを付けない**でください。Railway が渡す **PORT** を使わないと、プロキシがアプリに届かず 502 になります。
   - `package.json` の `"start": "next start"` もポート固定（`-p 3001`）にしないでください。

2. **デプロイログ**
   - Railway の **Deployments** → 該当デプロイを開き、**View Logs** で起動ログを確認する。
   - 「Error」「ECONNREFUSED」「OPENAI」「DATABASE」などで検索し、起動失敗や API/DB エラーが出ていないか見る。

3. **環境変数**
   - **OPENAI_API_KEY**: 誤字・欠け（先頭の `sk-` など）がないか確認。無効・期限切れキーだと 401 になり、アプリは 401 JSON を返す（502 にはならない想定）。
   - **DATABASE_URL**: DB を使う場合は PostgreSQL を追加し、**Variables** で **DATABASE_URL** を参照またはコピーして設定する。未設定のまま DB に依存する処理を呼ぶとエラーになることがあるが、チャット単体では永続化以外は動く。

4. **再デプロイ**
   - 上記を直したら **Redeploy** してから、再度 URL にアクセスして確認する。

---

## 5. デプロイ後の確認

1. **Settings** → **Networking** で **Generate Domain** を押し、公開 URL（例: `https://xxx.up.railway.app`）を発行する。
2. その URL を開き、トップや `/negotiation` が表示されることを確認する。
3. チャットや模擬商談でメッセージを送り、エラーにならず応答が返ってくれば、**OPENAI_API_KEY が正しく利用できています**。
4. 「OPENAI_API_KEY not configured」や 503 が出る場合は、**Variables** で `OPENAI_API_KEY` のスペルと値（先頭の `sk-` が欠けていないか）を確認し、**Redeploy** する。

---

## まとめ：OPENAI_API_KEY を有効にする手順だけ

1. Railway で **AI Agent のサービス** を開く。  
2. **Variables** で **`OPENAI_API_KEY`** を追加し、OpenAI の API キー（`sk-...`）を貼り付ける。  
3. 必要なら **`OPENAI_MODEL`** も追加（例: `gpt-4o-mini`）。  
4. 保存後、必要に応じて **Redeploy** する。  

これで Railway にデプロイした環境でも OPENAI_API_KEY が利用されます。
