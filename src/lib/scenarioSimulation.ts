/**
 * シナリオごとのシミュレーション概要（静的）
 * AI 詳細生成 API のコンテキストにも使用する。
 */

import type { ScenarioId } from '@/lib/negotiation';

export type ScenarioPhase = {
  label: string;
  description: string;
};

export type ScenarioSimulationStatic = {
  headline: string;
  premise: string;
  phases: ScenarioPhase[];
  focusPoints: string[];
  /** 演習のきっかけになりやすい一言例 */
  sampleCue?: string;
};

export const SCENARIO_SIMULATION_STATIC: Record<ScenarioId, ScenarioSimulationStatic> = {
  b2b_saas: {
    headline: '年間契約・ユーザー課金をめぐる交渉',
    premise:
      '中堅企業の情シス責任者と SaaS 営業が、予算・ユーザー数・サポート SLA を詰める場面です。',
    phases: [
      { label: '現状ヒアリング', description: '課題、既存ツール、今期の IT 予算の感触を確認する。' },
      { label: '提案・価値説明', description: 'ROI・工数削減・セキュリティ・統合の要点を短く伝える。' },
      { label: '条件交渉', description: 'ユーザー数ティア、支払い条件、オプションの取捨選択を詰める。' },
      { label: 'クロージング', description: '稟議スケジュール、PoC・デモ、次回までのアクションを約束する。' },
    ],
    focusPoints: ['予算上限と決裁プロセス', '競合比較への具体的な返し', 'SLA・解除条項・データ移行'],
    sampleCue: '「今期の IT 予算が厳しくて、ユーザー数を抑えたいのですが…」',
  },
  price_delivery: {
    headline: '単価・納期のすり合わせ（製造・調達）',
    premise: '購買と受注営業が、値引き・ロット・納期前倒しをトレードオフで調整します。',
    phases: [
      { label: '要件の再確認', description: '数量・希望納期・品質基準を整理する。' },
      { label: '見積の分解', description: '材料・加工・輸送の内訳と値引き余地を説明する。' },
      { label: '条件のバーター', description: 'ロット増・長期契約と価格、納期と分割納品を対比させる。' },
      { label: '合意形成', description: '期限・例外時の連絡フローを決め、発注に進む。' },
    ],
    focusPoints: ['原価とキャパの根拠提示', '競合他社との比較への対応', '品質・検査クレーム時の扱い'],
    sampleCue: '「単価をもう一段下げないと稟議が通らないのですが…」',
  },
  first_visit: {
    headline: '新規初回訪問〜ニーズの掘り起こし',
    premise: '担当者は忙しく警戒気味。短時間で課題と次のアクションを引き出します。',
    phases: [
      { label: '挨拶・目的', description: '訪問理由と所要時間を明示し信頼を取る。' },
      { label: 'ヒアリング', description: 'オープン質問で課題・優先度・予算感を聞く。' },
      { label: '軽い提案', description: 'ニーズに沿った事例・ソリューションを短く提示。' },
      { label: '次ステップ', description: '資料送付・再訪・キーパーソン同席の約束を取り付ける。' },
    ],
    focusPoints: ['長話を避け要点を押さえる', '押し売りに見えない質問の順番', '具体的な次の日付まで決める'],
    sampleCue: '「今日は 15 分だけお時間いただければ…」',
  },
  recruitment: {
    headline: '人材紹介・紹介料・保証条件',
    premise: '採用担当と紹介会社営業が、成功率・保証期間・単価を詰めます。',
    phases: [
      { label: 'ニーズ整理', description: '職種・スキル・年収レンジ・採用緊急度を確認。' },
      { label: '条件説明', description: '紹介料率・保証・返金・オプションを説明する。' },
      { label: '交渉', description: '予算制約に応じたパッケージ変更や保証延長のトレードオフ。' },
      { label: '開始合意', description: '求人票・面接フロー・連絡窓口を決める。' },
    ],
    focusPoints: ['他社紹介会社との条件比較', '成功定義と保証の境界', '独占・連絡頻度のルール'],
    sampleCue: '「紹介料はもう少し抑えたいのですが、保証は長めに取りたいです」',
  },
  media_sponsor: {
    headline: '広告・スポンサー掲載の単価と露出',
    premise: '広告主とメディア営業が、CPM・掲載枠・特集・期間を交渉します。',
    phases: [
      { label: 'ターゲットと目的', description: '訴求層、KPI、予算上限を共有する。' },
      { label: 'プラン提示', description: '枠・回数・セット割・読者属性を説明する。' },
      { label: '条件調整', description: '単価値引き、オプション同梱、成果連動の可否を詰める。' },
      { label: '契約・入稿', description: '期間、締切、クリエイティブ提出ルールを確認する。' },
    ],
    focusPoints: ['他メディアとの比較指標（実績数字）', '露出位置・回数の明文化', 'キャンセル・延期条項'],
    sampleCue: '「CPM をもう一段下げないと予算オーバーなんです」',
  },
  outsourcing: {
    headline: '開発外注・請負範囲と見積',
    premise: '発注側 PM と受注営業が、スコープ・総額・変更時の扱いを詰めます。',
    phases: [
      { label: '要件・スコープ', description: '機能一覧・優先度・除外範囲をすり合わせる。' },
      { label: '見積・工数', description: '人月単価・マイルストーン・リスクバッファを説明。' },
      { label: '交渉', description: '総額値引き・分期・追加要件の変更契約ルール。' },
      { label: '契約へ', description: '検収条件・支払いサイト・知的財産を確認する。' },
    ],
    focusPoints: ['スコープクリープと変更管理', '遅延時の責任分界', 'テスト・受入基準'],
    sampleCue: '「この範囲なら予算内ですが、追加は別見積になりますね」',
  },
  enterprise_license: {
    headline: 'エンタープライズライセンス・大規模導入',
    premise: '調達・情シスとベンダー営業が、規模・SLA・契約条項を交渉します。',
    phases: [
      { label: '要件・規模', description: 'ユーザー数・サイト・既存システム連携を確認。' },
      { label: 'ライセンス・価格', description: 'ボリュームディスカウント・サブスク／永続の選択肢。' },
      { label: 'SLA・セキュリティ', description: '稼働率、認証、ログ・監査、データ所在地を詰める。' },
      { label: '法務・決裁', description: '責任限制・解約・PoC 条件を法務と連携して整理。' },
    ],
    focusPoints: ['稟議・比較表に載せる数字（TCO）', 'PoC の範囲と成果判定', 'エスカレーション経路'],
    sampleCue: '「稟議では競合との差を数値で示す必要があります」',
  },
  renewal_contract: {
    headline: '更新・値上げ・継続特典',
    premise: '既存顧客と営業が、値上げ理由と継続メリットをすり合わせます。',
    phases: [
      { label: '現状確認', description: '利用状況・満足度・過去のトラブルを振り返る。' },
      { label: '改定説明', description: '値上げ・仕様変更の背景と市場水準を説明。' },
      { label: '交渉', description: '据え置き・段階値上げ・長期割引・機能追加のバーター。' },
      { label: '更新意図', description: '契約更新日・手続き・次回レビューを確認。' },
    ],
    focusPoints: ['長年の実績への感謝とデータで裏付け', '離脱リスク（他社切替）への反論', '追加価値の具体化'],
    sampleCue: '「昨年から結構値上げが続いていて、上司が厳しい目で見ています」',
  },
  partnership_mou: {
    headline: '業務提携・MOU・収益配分',
    premise: '提携先同士が、範囲・役割・収益配分・ IP を議論します。',
    phases: [
      { label: '目的共有', description: 'シナジー・ターゲット市場・タイムラインを確認。' },
      { label: '役割・スコープ', description: '開発／販売／サポート分担と KPI。' },
      { label: '経済条件', description: '収益配分・コスト負担・最低コミットの有無。' },
      { label: '次の一手', description: 'MOU→詳細契約・法務 DD・キックオフの日程。' },
    ],
    focusPoints: ['排他・非競業の範囲', '知的財産・ブランドの帰属', '解除・解約時の顧客対応'],
    sampleCue: '「まずは MOU で範囲だけ押さえたいのですが…」',
  },
  real_estate_lease: {
    headline: '賃貸オフィス・賃料・諸条件',
    premise: '借主と仲介／大家側が、賃料・初期費用・契約期間を交渉します。',
    phases: [
      { label: '希望条件', description: 'エリア・坪数・予算・入居時期を確認。' },
      { label: '物件説明', description: '賃料・共益費・保証金・更新料を内訳で説明。' },
      { label: '条件交渉', description: '賃料値引き・フリーレント・原状回復の範囲。' },
      { label: '申込・契約', description: '審査・契約書チェック・鍵渡しのスケジュール。' },
    ],
    focusPoints: ['初期費用の総額感', 'リニューアル・解約予告', '内装・原状回復の境界'],
    sampleCue: '「共益費込みでこのラインを超えると厳しいです」',
  },
  consulting_fee: {
    headline: 'コンサル報酬・スコープ・成果物',
    premise: '発注者とコンサルが、固定／成功報酬／日当とマイルストーンを詰めます。',
    phases: [
      { label: '課題定義', description: '成果イメージ・期限・社内ステークホルダーを確認。' },
      { label: '提案・見積', description: 'アプローチ・体制・報酬形態を提示。' },
      { label: '交渉', description: 'スコープ縮小・フェーズ分割・リスク分担を調整。' },
      { label: '契約', description: '成果物定義・変更手続・秘密保持を確認。' },
    ],
    focusPoints: ['スコープクリープ防止', '成功報酬の定義と計測方法', '途中解約時の精算'],
    sampleCue: '「成果が見えるまで固定だけだと稟議が通りにくいです」',
  },
  maintenance_sla: {
    headline: '保守・SLA・稼働率と料金',
    premise: '運用担当とベンダーが、稼働率・復旧時間・保守料を交渉します。',
    phases: [
      { label: '現状・課題', description: '障害履歴・運用時間帯・クリティカル度を確認。' },
      { label: 'SLA 提案', description: '標準／プレミアムの違いと価格を説明。' },
      { label: '交渉', description: '違反時クレジット・エスカレーション・オプション費用。' },
      { label: '契約更新', description: 'レビュー頻度・改善 KPI を取り込む。' },
    ],
    focusPoints: ['実際の復旧実績とのギャップ', '計画停止・メンテ窓の扱い', '上限コストの見える化'],
    sampleCue: '「夜間・休日の応答をどこまで担保できるかが鍵です」',
  },
  core_system_schedule_delay: {
    headline: '基幹開発の大幅遅延・リカバリ交渉',
    premise: '発注者が強い不満を持ち、ベンダーが原因説明と修正計画を提示します。',
    phases: [
      { label: '状況確認', description: '遅延幅・影響・契約上の位置づけを整理。' },
      { label: '原因・対策', description: 'ベンダーが原因と再発防止・修正スケジュールを説明。' },
      { label: '条件交渉', description: 'ペナルティ・追加費用負担・範囲・段階リリース。' },
      { label: '合意・監視', description: '定例会・報告線・エスカレーションを決める。' },
    ],
    focusPoints: ['感情的にならず事実と契約を突き合わせる', '現実的な代替スケジュール', 'ステークホルダーへの説明責任'],
    sampleCue: '「このままでは経営への説明ができません。いつまでに何ができますか」',
  },
  senior_it_engineer_dispatch: {
    headline: 'シニア IT エンジニア派遣・単価とリスク',
    premise: '派遣先が経験と単価・健康・代替体制を確認し、派遣会社が説明します。',
    phases: [
      { label: '要件・現場', description: '技術スタック・担当範囲・チーム構成を確認。' },
      { label: '人材紹介', description: '経歴・実績・稼働条件を説明。' },
      { label: '条件交渉', description: '単価・試用・交代時・勤務形態を詰める。' },
      { label: '契約', description: '責任分界・クレーム対応・契約解除を確認。' },
    ],
    focusPoints: ['年齢ではなくスキル・実績での評価', '欠勤・交代時の継続性', 'コンプライアンス・ハラスメント配慮'],
    sampleCue: '「レガシーは任せたいが、最新スタックのキャッチアップはどう担保されますか」',
  },
};

export function getScenarioSimulationStatic(id: ScenarioId): ScenarioSimulationStatic {
  return SCENARIO_SIMULATION_STATIC[id];
}
