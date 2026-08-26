'use client';

import { useDraggable } from '@dnd-kit/core';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare,
  Phone,
  Calendar,
  Clock,
  Flame,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { LeadStageType } from '@/core/types';
import { useRouter } from 'next/navigation';

export interface LeadCardModel {
  id: string;
  patientName: string;
  phone?: string;
  service: string;
  stage: LeadStageType;
  channel: 'whatsapp' | 'sms' | 'voice' | 'website' | 'manual';
  score?: 'hot' | 'warm' | 'cold' | number;
  value?: number;
  currency?: string;
  assignedOwner?: {
    name: string;
    avatarUrl?: string;
  };
  lastActivityAt: string;
  nextAppointmentAt?: string;
  attentionRequired?: boolean;
}

interface LeadKanbanCardProps {
  lead: LeadCardModel;
  onClick: (lead: LeadCardModel) => void;
  isOverlay?: boolean;
}

export function LeadKanbanCard({
  lead,
  onClick,
  isOverlay = false,
}: LeadKanbanCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });

  const getScoreBadge = () => {
    const isHot =
      lead.score === 'hot' ||
      (typeof lead.score === 'number' && lead.score >= 70);
    const isWarm =
      lead.score === 'warm' ||
      (typeof lead.score === 'number' && lead.score >= 40 && lead.score < 70);

    if (isHot) {
      return (
        <Badge className="gap-0.5 border border-red-500/30 bg-red-500/10 text-[10px] font-bold text-red-600 dark:text-red-400">
          <Flame className="size-2.5" />
          HOT {typeof lead.score === 'number' ? `(${lead.score})` : ''}
        </Badge>
      );
    }
    if (isWarm) {
      return (
        <Badge className="gap-0.5 border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-600 dark:text-amber-400">
          <span>🟡</span>
          WARM {typeof lead.score === 'number' ? `(${lead.score})` : ''}
        </Badge>
      );
    }
    return (
      <Badge className="gap-0.5 border border-blue-500/30 bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400">
        <span>🔵</span>
        COLD{' '}
        {typeof lead.score === 'number' && lead.score > 0
          ? `(${lead.score})`
          : ''}
      </Badge>
    );
  };

  const getChannelIcon = () => {
    switch (lead.channel) {
      case 'whatsapp':
        return <MessageSquare className="h-3 w-3 text-emerald-500" />;
      case 'sms':
        return <MessageSquare className="h-3 w-3 text-blue-500" />;
      case 'voice':
        return <Phone className="h-3 w-3 text-purple-500" />;
      default:
        return <MessageSquare className="text-muted-foreground h-3 w-3" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClick(lead)}
      tabIndex={0}
      role="button"
      aria-label={`${lead.patientName}, stage ${lead.stage}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(lead);
        }
      }}
      className={`group focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden ${
        isDragging ? 'opacity-30' : 'opacity-100'
      }`}
      style={{ touchAction: 'none' }}
    >
      <Card
        className={`bg-background border-border/80 hover:border-primary/50 relative cursor-grab overflow-hidden p-3.5 transition-all hover:shadow-md ${
          lead.attentionRequired ? 'ring-1 ring-amber-500/50' : ''
        } ${isOverlay ? 'ring-primary border-primary shadow-xl ring-2' : ''}`}
      >
        {/* Attention pulse indicator */}
        {lead.attentionRequired && (
          <span className="absolute top-2 right-2 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
          </span>
        )}

        <CardHeader className="p-0 pb-1.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-foreground group-hover:text-primary truncate text-sm font-semibold transition-colors">
              {lead.patientName}
            </CardTitle>
            {getScoreBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-2 p-0 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground truncate font-medium">
              {lead.service}
            </p>
            {lead.value !== undefined && lead.value > 0 && (
              <span className="text-foreground shrink-0 font-mono text-xs font-bold">
                {lead.currency === 'INR' || !lead.currency ? '₹' : '$'}
                {lead.value.toLocaleString()}
              </span>
            )}
          </div>

          {/* Appointment / Next follow-up info */}
          {lead.nextAppointmentAt && (
            <div className="bg-muted/50 text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]">
              <Calendar className="text-primary h-3 w-3 shrink-0" />
              <span className="truncate">{lead.nextAppointmentAt}</span>
            </div>
          )}

          {/* Card Footer */}
          <div className="border-border/50 flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="bg-muted/30 border-border text-foreground gap-1 text-[10px] font-medium capitalize"
              >
                {getChannelIcon()}
                {lead.channel}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {lead.assignedOwner && (
                <Avatar className="h-5 w-5" title={lead.assignedOwner.name}>
                  <AvatarImage src={lead.assignedOwner.avatarUrl} />
                  <AvatarFallback className="text-[9px] font-bold">
                    {lead.assignedOwner.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-muted-foreground flex items-center text-[10px]">
                <Clock className="mr-0.5 h-2.5 w-2.5" />
                {lead.lastActivityAt}
              </span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div
            className="flex items-center justify-end gap-1 pt-1 opacity-80 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              title="Open WhatsApp"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/inbox?contactId=${lead.id}`);
              }}
            >
              <MessageSquare className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-700"
              title="Schedule Task"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/tasks?patientId=${lead.id}`);
              }}
            >
              <CheckSquare className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-muted hover:text-foreground h-6 w-6"
              title="View Details"
              onClick={(e) => {
                e.stopPropagation();
                onClick(lead);
              }}
            >
              <Eye className="size-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
