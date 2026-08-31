import { redirect } from 'next/navigation';

export const metadata = {
  title: 'FAQ Bot - Helpa',
};

export default function FaqBotPage() {
  redirect('/knowledge-base?tab=faq');
}
