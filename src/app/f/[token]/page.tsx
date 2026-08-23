'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/ui/error-state';
import type { LeadFormField } from '@/types';

interface PublicFormResponse {
  data: {
    name: string;
    description?: string | null;
    fields: LeadFormField[];
    success_message?: string | null;
  };
}

export default function PublicLeadFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<PublicFormResponse['data'] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [violations, setViolations] = useState<
    { key: string; message: string }[]
  >([]);

  useEffect(() => {
    void (async () => {
      const { token: resolved } = await params;
      setToken(resolved);
    })();
  }, [params]);

  const fetchForm = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/public/forms/${token}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Unavailable');
      const payload = (await res.json()) as PublicFormResponse;
      setForm(payload.data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchForm();
  }, [fetchForm]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setViolations([]);
    try {
      const res = await fetch(`/api/public/forms/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, company_website: honeypot }),
      });
      if (res.status === 400) {
        const payload = await res.json().catch(() => ({}));
        setViolations(payload.violations ?? []);
        return;
      }
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
    } catch {
      setViolations([
        {
          key: '_',
          message: 'Something went wrong. Please try again in a moment.',
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-6 flex items-center justify-center gap-2 text-sm"
        >
          Powered by Helpa
        </Link>

        {loading && (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && failed && (
          <ErrorState
            title="This form is currently unavailable."
            message="It may have been paused or the link is incorrect."
            onRetry={() => void fetchForm()}
          />
        )}

        {!loading && !failed && submitted && (
          <div className="border-border bg-card text-card-foreground rounded-xl border p-8 text-center">
            <div className="mb-3 text-3xl">✓</div>
            <h1 className="text-foreground mb-2 text-lg font-semibold">
              {form?.success_message || 'Thank you!'}
            </h1>
            <p className="text-muted-foreground text-sm">
              Your details have been received. The team will reach out to you
              shortly.
            </p>
          </div>
        )}

        {!loading && !failed && !submitted && form && (
          <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
            <h1 className="text-foreground mb-1 text-xl font-bold">
              {form.name}
            </h1>
            {form.description && (
              <p className="text-muted-foreground mb-4 text-sm">
                {form.description}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Honeypot — hidden from humans, catnip for bots. */}
              <div className="absolute left-[-9999px]" aria-hidden="true">
                <label htmlFor="company_website">Company website</label>
                <input
                  id="company_website"
                  name="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {form.fields.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`f-${field.key}`}>
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`f-${field.key}`}
                      value={values[field.key] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={`f-${field.key}`}
                      type={
                        field.type === 'phone'
                          ? 'tel'
                          : field.type === 'number'
                            ? 'number'
                            : field.type === 'date'
                              ? 'date'
                              : field.type === 'email'
                                ? 'email'
                                : 'text'
                      }
                      inputMode={field.type === 'phone' ? 'tel' : undefined}
                      autoComplete={
                        field.key === 'name'
                          ? 'name'
                          : field.type === 'email'
                            ? 'email'
                            : field.type === 'phone'
                              ? 'tel'
                              : 'off'
                      }
                      value={values[field.key] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                  {violations
                    .filter((v) => v.key === field.key)
                    .map((v, i) => (
                      <p
                        key={i}
                        className="text-destructive mt-1 text-xs"
                        role="alert"
                      >
                        {v.message}
                      </p>
                    ))}
                </div>
              ))}

              {violations
                .filter((v) => v.key === '_')
                .map((v, i) => (
                  <p key={i} className="text-destructive text-sm" role="alert">
                    {v.message}
                  </p>
                ))}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                    Submit
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
