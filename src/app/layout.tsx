import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Agent — 音声・チャット・模擬商談',
  description: '音声とテキストで会話し、アクションを実行。実践的な模擬商談シミュレーションで営業スキルを磨けます。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
