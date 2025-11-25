"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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
import { getChartColor } from "./chartPalette";

interface ModelChartProps {
  data: ChartDataPoint[];
  activeModel: keyof Omit<ChartDataPoint, "imageNumber">;
  title?: string;
  description?: string;
}

export function ModelChart({
  data,
  activeModel,
  title = "SSIM Degradation Over Recursions",
  description = "Structural Similarity Index across recursive edits",
}: ModelChartProps) {
  const chartConfig = React.useMemo<ChartConfig>(() => {
    return MODELS.reduce((config, model, index) => {
      const isActive = model.key === activeModel;
      config[model.key] = {
        label: model.displayName,
        highlight: isActive,
        color: isActive ? getChartColor(index) : "var(--muted-foreground)",
      };
      return config;
    }, {} as ChartConfig);
  }, [activeModel]);

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            data={data}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="imageNumber"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{
                value: "Image Number (Recursion)",
                position: "insideBottom",
                offset: -5,
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
            {MODELS.map((model) => {
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
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
