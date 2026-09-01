import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('reception accessibility labels', () => {
  it('announces login errors and labels the password toggle', () => {
    const login = readSrc('src/app/(auth)/login/page.tsx');
    expect(login).toContain('role="alert"');
    expect(login).toContain('aria-live="assertive"');
    expect(login).toContain("showPassword ? 'Hide password' : 'Show password'");
    expect(login).toContain('htmlFor="remember-me"');
    expect(login).toContain('id="remember-me"');
    expect(login).toContain('motion-reduce:animate-none');
  });

  it('labels the inbox composer and expands tap targets without changing chrome', () => {
    const composer = readSrc('src/components/inbox/message-composer.tsx');
    expect(composer).toContain('aria-label="Message"');
    expect(composer).toContain('aria-label="Send message"');
    expect(composer).toContain('aria-label="Send template"');
    expect(composer).toContain('aria-label="Attach media"');
    expect(composer).toContain('aria-label="Stop recording"');
    expect(composer).toContain('aria-label="Cancel recording"');
    expect(composer).toContain('before:-inset-1.5');
    expect(composer).toContain('sm:pl-[5.5rem]');
  });

  it('labels thread scroll, reactions, and report actions', () => {
    const thread = readSrc('src/components/inbox/message-thread.tsx');
    expect(thread).toContain('aria-label="Scroll to latest message"');
    const reactions = readSrc('src/components/inbox/message-reactions.tsx');
    expect(reactions).toContain('aria-label={`Reaction ${g.emoji}');
    const sidebar = readSrc('src/components/inbox/contact-sidebar.tsx');
    expect(sidebar).toContain('aria-label="Download report PDF"');
    expect(sidebar).toContain('aria-label={');
    expect(sidebar).toContain('Send report via WhatsApp');
  });

  it('labels inbox search, filters, and appointment tabs', () => {
    const list = readSrc('src/components/inbox/conversation-list.tsx');
    expect(list).toContain('aria-label="Search conversations"');
    expect(list).toContain('aria-pressed={filter ===');
    const appointments = readSrc('src/app/(dashboard)/appointments/page.tsx');
    expect(appointments).toContain('role="tablist"');
    expect(appointments).toContain('aria-label="Appointment views"');
  });
});
