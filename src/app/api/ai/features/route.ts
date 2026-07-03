import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/whatsapp/encryption';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the caller's account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountId = profile?.account_id;
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action parameter is required.' }, { status: 400 });
    }

    // Fetch OpenRouter configuration from accounts
    const { data: account, error: accError } = await supabase
      .from('accounts')
      .select('openrouter_api_key, openrouter_model, ai_system_prompt')
      .eq('id', accountId)
      .single();

    if (accError || !account?.openrouter_api_key) {
      return NextResponse.json({ error: 'AI Assistant (OpenRouter) is not configured.' }, { status: 400 });
    }

    // Decrypt API key
    let apiKey: string;
    try {
      apiKey = decrypt(account.openrouter_api_key);
    } catch (err) {
      console.error('[AI API] Failed to decrypt OpenRouter API Key:', err);
      return NextResponse.json({ error: 'Saved OpenRouter API Key cannot be decrypted. Please re-configure and save it under Settings -> AI Agent.' }, { status: 400 });
    }

    const model = account.openrouter_model || 'google/gemini-2.5-flash';

    if (action === 'suggest') {
      const { conversationId } = body;
      if (!conversationId) {
        return NextResponse.json({ error: 'conversationId is required for suggest.' }, { status: 400 });
      }

      // Check if conversation belongs to account
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('account_id')
        .eq('id', conversationId)
        .single();

      if (convError || !conversation || conversation.account_id !== accountId) {
        return NextResponse.json({ error: 'Conversation not found or unauthorized.' }, { status: 404 });
      }

      // Fetch Knowledge Base
      const { data: kbEntries } = await supabase
        .from('knowledge_base')
        .select('title, content, category')
        .eq('account_id', accountId);

      let kbContext = '';
      if (kbEntries && kbEntries.length > 0) {
        kbContext = 'Knowledge Base Context:\n' + kbEntries
          .map(entry => `Category: ${entry.category}\nTitle: ${entry.title}\nContent: ${entry.content}`)
          .join('\n\n');
      }

      // Fetch conversation context (latest 15 messages)
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('sender_type, content_type, content_text, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (msgError || !messages || messages.length === 0) {
        return NextResponse.json({ error: 'No messages found in conversation.' }, { status: 400 });
      }

      messages.reverse();

      const latestMessage = messages[messages.length - 1];

      // Formulate prompt messages
      const basePrompt = account.ai_system_prompt || 
        `Use the System Message, Knowledge Base, and Conversation History as your primary sources of information to suggest a helpful response.`;

      let systemPromptContent = basePrompt;
      if (kbContext) {
        systemPromptContent += `\n\n${kbContext}`;
      }

      systemPromptContent += `\n\nLanguage Instruction: The customer's latest message is: "${latestMessage.content_text || ''}". You must write the reply in the EXACT same language as this latest message.`;

      systemPromptContent += `\n\nCRITICAL INSTRUCTION: You are suggesting a reply to the customer for a human agent to send. Respond ONLY with the direct text of the suggestion. Do not wrap in quotes, do not output any explanations or labels, and do not use JSON. Write it in an organized format with line breaks and friendly emojis.`;

      const apiMessages = [
        { role: 'system', content: systemPromptContent },
        ...messages
          .map(m => {
            let content = m.content_text || '';
            if (!content && m.content_type) {
              content = `[${m.content_type}]`;
            }
            return {
              role: m.sender_type === 'customer' ? 'user' : 'assistant',
              content: content,
            };
          })
          .filter(m => m.content !== '')
      ];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://wacrm.tech',
          'X-Title': 'wacrm',
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error (status ${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const aiResponse = resJson.choices?.[0]?.message?.content?.trim();

      return NextResponse.json({ result: aiResponse });

    } else if (action === 'rewrite') {
      const { text, tone } = body;
      if (!text) {
        return NextResponse.json({ error: 'text parameter is required for rewrite.' }, { status: 400 });
      }

      const promptContent = `You are an expert copywriter. Rewrite the following text to make it sound ${tone || 'professional and friendly'}. 
Maintain the same language. 
Respond ONLY with the rewritten text. Do not add quotes, do not add comments, and do not explain the changes.
Text to rewrite:
"${text}"`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://wacrm.tech',
          'X-Title': 'wacrm',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptContent }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error (status ${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const aiResponse = resJson.choices?.[0]?.message?.content?.trim();

      return NextResponse.json({ result: aiResponse });

    } else if (action === 'translate') {
      const { text, targetLanguage } = body;
      if (!text || !targetLanguage) {
        return NextResponse.json({ error: 'text and targetLanguage parameters are required for translate.' }, { status: 400 });
      }

      const promptContent = `Translate the following text into ${targetLanguage}.
Respond ONLY with the exact translation. Do not add explanations, quotes, or other text.
Text to translate:
"${text}"`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://wacrm.tech',
          'X-Title': 'wacrm',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptContent }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error (status ${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const aiResponse = resJson.choices?.[0]?.message?.content?.trim();

      return NextResponse.json({ result: aiResponse });

    } else {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

  } catch (err: any) {
    console.error('[AI API] Server Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
