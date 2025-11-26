"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ChartDataPoint, MODELS } from "@/lib/rockBenchTypes";
import { supabase } from "@/lib/supabase";
import { getChartColor } from "./chartPalette";

interface ModelChartProps {
  data: ChartDataPoint[];
  activeModel: keyof Omit<ChartDataPoint, "imageNumber">;
  title?: string;
  description?: string;
  revealIndex?: number;
  order?: Array<keyof Omit<ChartDataPoint, "imageNumber">>;
  caption?: string;
}

export function ModelChart({
  data,
  activeModel,
  title,
  description,
  revealIndex,
  order,
  caption,
}: ModelChartProps) {
  const [rttntr, setRttntr] = useState<number | null>(null);

  const keyToModel = React.useMemo(
    () =>
      MODELS.reduce<Record<string, (typeof MODELS)[number]>>((map, model) => {
        map[model.key] = model;
        return map;
      }, {}),
    []
  );

  const displayOrder = React.useMemo(
    () => order ?? MODELS.map((m) => m.key),
    [order]
  );

  const activeIndex = React.useMemo(
    () => displayOrder.findIndex((key) => key === activeModel),
    [activeModel, displayOrder]
  );

  const activeModelInfo = keyToModel[activeModel];
  const resolvedTitle =
    title || `${activeModelInfo?.displayName ?? activeModel} SSIM Degradation`;

  useEffect(() => {
    const loadRtt = async () => {
      if (!supabase) {
        setRttntr(null);
        return;
      }
      const { data, error } = await supabase
        .from("rock_votes")
        .select("first_not_rock")
        .eq("model", activeModel);

      if (error || !data?.length) {
        setRttntr(null);
        return;
      }
      const values = data
        .map((row: { first_not_rock: number }) => Number(row.first_not_rock))
        .filter((num) => !Number.isNaN(num));

      if (!values.length) {
        setRttntr(null);
        return;
      }

      const avg =
        values.reduce((sum, val) => sum + val, 0) / values.length;
      setRttntr(Math.round(avg));
    };

    loadRtt();
  }, [activeModel]);

  const chartConfig = React.useMemo<ChartConfig>(() => {
    const revealCutoff =
      typeof revealIndex === "number" ? revealIndex : activeIndex;

    return displayOrder.reduce((config, key, index) => {
      if (index > revealCutoff) {
        return config;
      }
      const model = keyToModel[key];
      if (!model) return config;
      const isActive = key === activeModel;
      config[model.key] = {
        label: model.displayName,
        highlight: isActive,
        color: isActive ? getChartColor(index) : "var(--muted-foreground)",
      };
      return config;
    }, {} as ChartConfig);
  }, [activeIndex, activeModel, displayOrder, keyToModel, revealIndex]);

  return (
    <figure className="my-8 space-y-2">
      <Card>
        <CardHeader>
          <CardTitle>{resolvedTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full h-[320px] px-2">
            <LineChart
              data={data}
              margin={{
                left: 12,
                right: 12,
                top: 12,
                bottom: 32,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="imageNumber"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                label={{
                  value: "Image Number (Recursion)",
                  position: "bottom",
                  offset: 0,
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                label={{
                  value: "SSIM",
                  angle: -90,
                  position: "insideLeft",
                }}
                domain={[0, 1]}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={<ChartTooltipContent indicator="line" />}
              />
              {displayOrder
                .filter((_, idx) => {
                  const revealCutoff =
                    typeof revealIndex === "number" ? revealIndex : activeIndex;
                  return idx <= revealCutoff;
                })
                .map((key, index) => {
                  const model = keyToModel[key];
                  if (!model) return null;
                  const isActive = model.key === activeModel;
                return (
                  <Line
                    key={model.key}
                    dataKey={model.key}
                    type="monotone"
                    stroke={`var(--color-${model.key})`}
                    strokeWidth={isActive ? 3 : 1.25}
                    dot={false}
                    strokeOpacity={isActive ? 1 : 0.35}
                    connectNulls
                  />
                );
                })}
              {rttntr != null ? (
                <ReferenceLine
                  x={rttntr}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Not The Rock (${rttntr})`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    offset: 12,
                  }}
                />
              ) : null}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      {caption ? (
        <figcaption className="mx-auto max-w-2xl text-center text-base italic leading-relaxed text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
