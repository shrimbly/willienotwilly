"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    const next: Record<string, VoteStats> = {};
    for (const model of MODELS) {
      const { data, error: err, count } = await supabase
        .from("rock_votes")
        .select("first_not_rock", { count: "exact" })
        .eq("model", model.key);
      if (err) {
        next[model.key] = { avg: null, count: 0 };
        setError(err.message);
        continue;
      }
      if (!data || data.length === 0) {
        next[model.key] = { avg: null, count: 0 };
        continue;
      }
      const avgVal =
        data.reduce((acc, row) => acc + Number(row.first_not_rock), 0) /
        (count ?? data.length);
      next[model.key] = { avg: avgVal, count: count ?? data.length };
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
    const bestRtt = rtts.length ? Math.min(...rtts) : undefined;

    setBest({
      peak: bestPeak.toFixed(3),
      avg: bestAvg.toFixed(3),
      cost: bestCost,
      rttntr: bestRtt,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <th className="py-2 pr-3">Cost (per image)</th>
              <th className="py-2 pr-3">RTTNTR</th>
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
