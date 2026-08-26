'use client';

import { useMemo } from 'react';
import type { Deal, PipelineStage } from '@/types';
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Trophy,
  XCircle,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatCurrency } from '@/lib/currency';

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Won) = 100%. Lost deals excluded.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[]
): number {
  const n = sortedStages.length;
  if (n <= 1) return 1;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const { terminology } = useWorkspace();
  const itemsLower = terminology.pipelineItems.toLowerCase();
  const itemLower = terminology.pipelineItem.toLowerCase();
  const { defaultCurrency } = useAuth();
  const sortedStages = useMemo(
    () =>
      [...stages].sort(
        (a, b) =>
          (a.order_index ?? a.position ?? 0) -
          (b.order_index ?? b.position ?? 0)
      ),
    [stages]
  );

  const stats = useMemo(() => {
    const active = deals.filter((d) => d.status !== 'lost');
    const openDeals = active.filter((d) => d.status !== 'won');

    const totalCount = active.length;
    const totalValue = active.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    const stageById = new Map(sortedStages.map((s) => [s.id, s]));
    const weightedValue = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeStageProbability(stage, sortedStages);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (d: Deal) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };
    const wonThisMonth = deals.filter(
      (d) => d.status === 'won' && thisMonth(d)
    ).length;
    const lostThisMonth = deals.filter(
      (d) => d.status === 'lost' && thisMonth(d)
    ).length;

    return {
      totalCount,
      totalValue,
      avgValue,
      weightedValue,
      wonThisMonth,
      lostThisMonth,
    };
  }, [deals, sortedStages]);

  return (
    <TooltipProvider>
      <div className="border-border bg-card/60 grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-3 xl:grid-cols-6">
        <Metric
          icon={<BarChart3 className="text-muted-foreground h-4 w-4" />}
          label={`Total ${terminology.pipelineItems}`}
          value={String(stats.totalCount)}
          tooltip={`Count of every ${itemLower} in this pipeline that isn't marked as Lost. Won ${itemsLower} are still included.`}
        />
        <Metric
          icon={<DollarSign className="text-primary h-4 w-4" />}
          label="Pipeline Value"
          value={formatCurrency(stats.totalValue, defaultCurrency)}
          tooltip={`Sum of the values of all ${itemsLower} in this pipeline, excluding ${itemsLower} marked as Lost.`}
        />
        <Metric
          icon={<Target className="h-4 w-4 text-blue-400" />}
          label={`Avg ${terminology.pipelineItem} Size`}
          value={formatCurrency(stats.avgValue, defaultCurrency)}
          tooltip={`Pipeline Value divided by Total ${terminology.pipelineItems} — the average value of a single non-lost ${itemLower}.`}
        />
        <Metric
          icon={<TrendingUp className="h-4 w-4 text-purple-400" />}
          label="Weighted Value"
          value={formatCurrency(stats.weightedValue, defaultCurrency)}
          tooltip={`Expected revenue: each open ${itemLower}'s value × its stage probability. First stage ≈ 10%, stages progress up to 90%, Won = 100%. Lost ${itemsLower} are excluded.`}
        />
        <Metric
          icon={<Trophy className="text-primary h-4 w-4" />}
          label="Won This Month"
          value={String(stats.wonThisMonth)}
          tooltip={`${terminology.pipelineItems} marked as Won since the first day of the current month.`}
        />
        <Metric
          icon={<XCircle className="h-4 w-4 text-red-400" />}
          label="Lost This Month"
          value={String(stats.lostThisMonth)}
          tooltip={`${terminology.pipelineItems} marked as Lost since the first day of the current month.`}
        />
      </div>
    </TooltipProvider>
  );
}

function Metric({
  icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
        {icon}
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`How ${label} is calculated`}
                className="text-muted-foreground hover:text-foreground ml-auto focus:outline-none"
              />
            }
          >
            <Info className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="text-foreground mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
