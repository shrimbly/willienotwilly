"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type VoteStats = { avg: number | null; count: number };

type ModelRow = {
  key:
    | "gpt"
    | "gptMini"
    | "nanoBananaPro"
    | "seedream"
    | "qwen"
    | "nanoBanana"
    | "flux";
  name: string;
  peak: string;
  avg: string;
  cost: string;
};

const MODELS: ModelRow[] = [
  { key: "gpt", name: "GPT-Image1", peak: "0.444", avg: "0.017", cost: "$0.04" },
  { key: "gptMini", name: "GPT-Image1-mini", peak: "0.289", avg: "0.135", cost: "$0.02" },
  { key: "nanoBananaPro", name: "Nano Banana Pro", peak: "0.858", avg: "0.278", cost: "$0.14" },
  { key: "nanoBanana", name: "Nano Banana", peak: "0.655", avg: "0.262", cost: "$0.039" },
  { key: "seedream", name: "SeeDream 4", peak: "0.756", avg: "0.265", cost: "$0.03" },
  { key: "qwen", name: "Qwen Image Edit", peak: "0.932", avg: "0.251", cost: "$0.03" },
  { key: "flux", name: "Flux Kontext Pro", peak: "0.907", avg: "0.314", cost: "$0.04" },
];

export function RockVoteTable() {
  const [stats, setStats] = useState<Record<string, VoteStats>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [best, setBest] = useState<{
    peak?: string;
    avg?: string;
    cost?: number;
    rttntr?: number;
  }>({});

  const fetchVotes = async () => {
    if (!supabase) {
      setError("Supabase env vars missing.");
      return;
    }
    setLoading(true);
    setError(null);

    // Single query to fetch all votes, then aggregate client-side
    const { data, error: err } = await supabase
      .from("rock_votes")
      .select("model, first_not_rock");

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Aggregate stats by model client-side
    const next: Record<string, VoteStats> = {};
    for (const model of MODELS) {
      next[model.key] = { avg: null, count: 0 };
    }

    if (data && data.length > 0) {
      const grouped: Record<string, number[]> = {};
      for (const row of data) {
        if (!grouped[row.model]) {
          grouped[row.model] = [];
        }
        grouped[row.model].push(Number(row.first_not_rock));
      }

      for (const [modelKey, values] of Object.entries(grouped)) {
        const sum = values.reduce((acc, v) => acc + v, 0);
        next[modelKey] = { avg: sum / values.length, count: values.length };
      }
    }

    setStats(next);

    // derive bests
    const peaks = MODELS.map((m) => Number(m.peak));
    const avgs = MODELS.map((m) => Number(m.avg));
    const costs = MODELS.map((m) => Number(m.cost.replace(/[^0-9.]/g, "")));
    const rtts = Object.entries(next)
      .filter(([, v]) => v.avg != null)
      .map(([, v]) => v.avg as number);

    const bestPeak = Math.max(...peaks);
    const bestAvg = Math.max(...avgs);
    const bestCost = Math.min(...costs);
    const bestRtt = rtts.length ? Math.max(...rtts) : undefined;

    setBest({
      peak: bestPeak.toFixed(3),
      avg: bestAvg.toFixed(3),
      cost: bestCost,
      rttntr: bestRtt,
    });

    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVotes();
  }, []);

  return (
    <div className="not-prose my-8 rounded-2xl border border-border bg-card/50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-lg font-semibold">Model summary</h3>
        <button
          type="button"
          onClick={fetchVotes}
          disabled={loading}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border/80">
              <th className="py-2 pr-3">Model</th>
              <th className="py-2 pr-3">Peak SSIM</th>
              <th className="py-2 pr-3">Avg SSIM</th>
              <th className="py-2 pr-3">Cost p/image</th>
              <th className="py-2 pr-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex items-center gap-1">
                      SWG
                      <HelpCircle className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Spontaneous white guy</p>
                  </TooltipContent>
                </Tooltip>
              </th>
              <th className="py-2 pr-3">TNTR</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((model, idx) => {
              const vote = stats[model.key];
              const rtt =
                !vote || vote.avg == null
                  ? "—"
                  : `${Math.round(vote.avg)} (${vote.count})`;
              const costNum = Number(model.cost.replace(/[^0-9.]/g, ""));
              const swg = model.key === "gptMini" || model.key === "flux" || model.key === "seedream";
              return (
                <tr
                  key={model.key}
                  className={idx % 2 === 0 ? "bg-muted/20" : "bg-transparent"}
                >
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {model.name}
                  </td>
                  <td className={`py-2 pr-3 ${model.peak === best.peak ? "font-semibold" : ""}`}>
                    {model.peak}
                  </td>
                  <td className={`py-2 pr-3 ${model.avg === best.avg ? "font-semibold" : ""}`}>
                    {model.avg}
                  </td>
                  <td className={`py-2 pr-3 ${costNum === best.cost ? "font-semibold" : ""}`}>
                    {model.cost}
                  </td>
                  <td className="py-2 pr-3">
                    {swg ? "✓" : "—"}
                  </td>
                  <td
                    className={`py-2 pr-3 ${
                      vote?.avg != null && Math.round(vote.avg) === best.rttntr
                        ? "font-semibold"
                        : ""
                    }`}
                  >
                    {rtt}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
