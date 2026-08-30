import { redirect } from 'next/navigation';

export const metadata = {
  title: 'AI Receptionist - Helpa',
};

export default function ChatbotPage() {
  redirect('/knowledge-base?tab=receptionist');
}
