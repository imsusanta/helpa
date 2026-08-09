'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import type { Contact } from '@/types';

interface SendOutboundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContact?: Contact | null;
  onSuccess?: () => void;
}

export function SendOutboundModal({
  open,
  onOpenChange,
  defaultContact,
  onSuccess,
}: SendOutboundModalProps) {
  const supabase = createClient();
  const { accountId, account } = useAuth();
  void accountId;
  const businessName = account?.name || 'our Clinic';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('name', { ascending: true })
      .limit(50);
    if (data) {
      setContacts(data);
    }
    setLoadingContacts(false);
  }, [supabase]);

  useEffect(() => {
    if (open) {
      if (defaultContact) {
        setSelectedContactId(defaultContact.id);
        setCustomName(defaultContact.name || '');
        setCustomPhone(defaultContact.phone || '');
      } else {
        fetchContacts();
      }
    }
  }, [open, defaultContact, fetchContacts]);

  function handleSelectContact(id: string) {
    setSelectedContactId(id);
    const selected = contacts.find((c) => c.id === id);
    if (selected) {
      setCustomName(selected.name || '');
      setCustomPhone(selected.phone || '');
    }
  }

  function setQuickTemplate(type: 'welcome' | 'appointment' | 'report') {
    const patientName = customName || 'Patient';
    if (type === 'welcome') {
      setMessage(
        `Hello ${patientName}, welcome to *${businessName}*! 🏥 How can we assist you with your healthcare and consultation needs today?`
      );
    } else if (type === 'appointment') {
      setMessage(
        `Hello ${patientName}, this is a reminder from *${businessName}* regarding your upcoming doctor consultation appointment. Please let us know if you need to confirm or reschedule.`
      );
    } else if (type === 'report') {
      setMessage(
        `Hello ${patientName}, your diagnostic lab test report from *${businessName}* is ready. You can reply 'REPORT' to get your report PDF directly on WhatsApp.`
      );
    }
  }

  async function handleSend() {
    const targetPhone = customPhone.trim();
    if (!targetPhone) {
      toast.error('Recipient phone number is required');
      return;
    }
    if (!message.trim()) {
      toast.error('Message content cannot be empty');
      return;
    }

    setSending(true);

    try {
      // Send outbound WhatsApp message via API (Backend resolves or creates contact & conversation seamlessly)
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          contact_id: selectedContactId || undefined,
          name: customName.trim() || undefined,
          message_type: 'text',
          content_text: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send outbound message');
      }

      toast.success(
        `Outbound WhatsApp message sent to ${customName || targetPhone}!`
      );
      setMessage('');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('Outbound message failed:', err);
      toast.error(
        'Failed to send outbound message: ' +
          ((err as Error).message || 'Unknown error')
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-popover-foreground">
                Send Outbound WhatsApp Message
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Directly contact patients or leads on WhatsApp
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!defaultContact && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Select Existing Patient / Contact
              </Label>
              <select
                value={selectedContactId}
                onChange={(e) => handleSelectContact(e.target.value)}
                disabled={loadingContacts}
                className="border-border bg-muted text-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="">-- Or enter new phone below --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Unnamed'} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Patient / Contact Name
              </Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Rahul Sharma"
                className="bg-muted border-border text-foreground h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Mobile Number <span className="text-red-400">*</span>
              </Label>
              <Input
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="+919876543210"
                className="bg-muted border-border text-foreground h-9 font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs">
                Quick Templates
              </Label>
              <span className="text-muted-foreground text-[10px]">
                Click to insert
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickTemplate('welcome')}
                className="bg-muted/60 hover:bg-muted border-border h-7 text-[11px]"
              >
                👋 Welcome
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickTemplate('appointment')}
                className="bg-muted/60 hover:bg-muted border-border h-7 text-[11px]"
              >
                📅 Doctor Appointment
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickTemplate('report')}
                className="bg-muted/60 hover:bg-muted border-border h-7 text-[11px]"
              >
                📋 Lab Report
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              WhatsApp Message <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message to the patient here..."
              className="bg-muted border-border text-foreground min-h-[100px] resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="bg-popover border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !customPhone.trim() || !message.trim()}
            className="gap-1.5 bg-emerald-600 font-medium text-white hover:bg-emerald-700"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send Outbound WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
