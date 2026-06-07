export const TERMS_UPDATED_AT = "2026年6月7日";

export const TERMS_SECTIONS = [
  {
    title: "第1条 適用",
    body: "本規約は、将棋をしようの利用に関する条件を定めるものです。利用者は、本サービスを利用することで本規約に同意したものとします。",
  },
  {
    title: "第2条 アカウント",
    body: "利用者は、登録情報を正確に管理し、第三者にアカウントを利用させないものとします。ハンドルや表示名に、他者を害する表現や誤認を招く表現を使用しないでください。",
  },
  {
    title: "第3条 禁止事項",
    body: "不正アクセス、過度な負荷をかける行為、対局相手への迷惑行為、法令または公序良俗に反する行為、本サービスの運営を妨げる行為を禁止します。",
  },
  {
    title: "第4条 対局データ",
    body: "本サービスは、対局の進行、再接続、履歴表示のために必要な対局データを保存することがあります。利用者は、保存された対局データがサービス運営や品質改善に利用されることに同意します。",
  },
  {
    title: "第5条 サービスの変更・停止",
    body: "運営者は、保守、障害対応、機能改善などのため、事前の通知なく本サービスの内容を変更または停止することがあります。",
  },
  {
    title: "第6条 免責",
    body: "本サービスは現状有姿で提供されます。運営者は、利用者に生じた損害について、故意または重過失がある場合を除き責任を負いません。",
  },
  {
    title: "第7条 規約の変更",
    body: "運営者は、必要に応じて本規約を変更できます。変更後の規約は、本サービス上に掲載された時点から効力を生じます。",
  },
  {
    title: "第8条 準拠法",
    body: "本規約は日本法に準拠します。",
  },
] as const;

export const TERMS_TEXT = [
  `最終更新日: ${TERMS_UPDATED_AT}`,
  ...TERMS_SECTIONS.flatMap((section) => [section.title, section.body]),
].join("\n");

const encoder = new TextEncoder();

export async function currentTermsHash(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(TERMS_TEXT));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
