'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, MessageSquare } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen w-full flex-col items-center justify-center p-6 text-center">
      <div className="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
        <MessageSquare className="h-8 w-8 text-[#110E3D]" />
      </div>
      <span className="mb-3 rounded-full bg-[#110E3D] px-3 py-1 text-xs font-bold tracking-widest text-[#B4F73C] uppercase">
        404 — Page Not Found
      </span>
      <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
        Lost in the conversational flow?
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm">
        The page you are looking for does not exist, has been moved, or is
        temporarily unavailable.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button
            variant="default"
            className="gap-2 bg-[#110E3D] text-white hover:bg-[#1b1754]"
          >
            <Home className="h-4 w-4" />
            Return Home
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go to Workspace
          </Button>
        </Link>
      </div>
    </div>
  );
}
