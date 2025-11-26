"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/rockBenchTypes";
import { Button } from "@/components/ui/button";

type ModelKey = (typeof MODELS)[number]["key"];

type Mode = "view" | "voting";

interface RockVotePromptProps {
  model: ModelKey;
}

function padIndex(index: number) {
  return String(index).padStart(3, "0");
}

export function RockVotePrompt({ model }: RockVotePromptProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [selection, setSelection] = useState(50);
  const [yourVote, setYourVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<{ avg: number | null; count: number }>({
    avg: null,
    count: 0,
  });

  const displayName = useMemo(
    () => MODELS.find((m) => m.key === model)?.displayName ?? model,
    [model]
  );

  const baseUrl = process.env.NEXT_PUBLIC_ROCK_BENCH_R2_URL?.replace(/\/+$/, "");
  const assetModel = useMemo(() => {
    const map: Record<ModelKey, string> = {
      flux: "flux",
      gpt: "gpt",
      gptMini: "gptMini",
      nanoBanana: "nanoBanana",
      nanoBananaPro: "nanoBananaPro",
      qwen: "qwen",
      seedream: "seedream",
    };
    return map[model];
  }, [model]);

  const fetchStats = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("rock_votes")
      .select("first_not_rock")
      .eq("model", model);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data?.length) {
      setStats({ avg: null, count: 0 });
      setSelection(50);
      return;
    }
    const sum = data.reduce((acc, row) => acc + Number(row.first_not_rock), 0);
    const average = sum / data.length;
    setStats({ avg: average, count: data.length });
    setSelection(Math.round(average));
  }, [model]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStats();
  }, [model, fetchStats]);

  const handleSubmit = async () => {
    if (!supabase) {
      setMessage(
        "Voting is not configured. Add Supabase env vars to enable submissions."
      );
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.from("rock_votes").insert([
      {
        model,
        first_not_rock: selection,
      },
    ]);
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    setYourVote(selection);
    await fetchStats();
    setLoading(false);
    setMode("view");
  };

  const avgLabel =
    stats.avg == null ? "-" : Math.round(stats.avg).toString().padStart(2, "0");

  const displayValue = mode === "voting" ? selection : avgLabel;
  const displayImageIndex =
    mode === "voting" || stats.avg == null
      ? selection
      : Math.max(0, Math.min(100, Math.round(stats.avg)));
  const displayImageSrc = baseUrl
    ? `${baseUrl}/rock-bench/${assetModel}/image_${padIndex(displayImageIndex)}.webp`
    : "";

  return (
    <div className="my-8 rounded-2xl border border-border bg-card/50 p-5 shadow-sm not-prose">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-start">
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>{displayName}</span>
              <span>•</span>
              <span>
                {stats.count} vote{stats.count === 1 ? "" : "s"}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold">
                Images till &apos;That&apos;s not The Rock&apos;
              </p>
              <p className="text-5xl font-bold">{displayValue}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {yourVote != null
                ? `Your vote: ${yourVote}`
                : stats.avg == null
                  ? "Be the first to vote"
                  : ""}
            </p>

            {mode === "voting" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selection}
                    onChange={(e) => setSelection(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-primary"
                  />
                  <span className="w-12 text-right text-base font-semibold">
                    {selection}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Slide to the first image that isn&apos;t The Rock.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {mode === "voting" ? (
              <>
                <Button size="sm" onClick={handleSubmit} disabled={loading}>
                  {loading ? "Submitting..." : "That's not 'The Rock'"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode("view")}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setMode("voting")}>
                Vote
              </Button>
            )}
            {message ? (
              <span className="text-xs text-red-500">{message}</span>
            ) : null}
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl bg-muted/40 aspect-[4/5] max-h-[360px]">
          {displayImageSrc ? (
            <Image
              src={displayImageSrc}
              alt={`Recursion ${displayImageIndex} for ${displayName}`}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Set NEXT_PUBLIC_ROCK_BENCH_R2_URL to show images
            </div>
          )}
          <div className="absolute right-3 top-3 rounded bg-background/80 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            Image {displayImageIndex}
          </div>
        </div>
      </div>
    </div>
  );
}
