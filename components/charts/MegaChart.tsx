"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Legend } from "recharts";
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

interface MegaChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
}

const megaChartConfig: ChartConfig = MODELS.reduce((config, model, index) => {
  config[model.key] = {
    label: model.displayName,
    color: getChartColor(index),
  };
  return config;
}, {} as ChartConfig);

export function MegaChart({
  data,
  title = "All Models: SSIM Degradation Comparison",
  description = "Comparative performance across all 7 image editing models",
}: MegaChartProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 640);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={megaChartConfig}
          className="w-full h-[360px] sm:h-[500px]"
        >
          <LineChart
            data={data}
            margin={{
              left: isMobile ? 6 : 12,
              right: isMobile ? 6 : 12,
              top: 12,
              bottom: isMobile ? 8 : 12,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="imageNumber"
              tickLine={false}
              axisLine={false}
              tickMargin={isMobile ? 6 : 8}
              label={{
                value: "Image Number (Recursion)",
                position: "insideBottom",
                offset: -5,
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              {...(isMobile
                ? {
                    width: 32,
                    tickMargin: 4,
                  }
                : {
                    tickMargin: 8,
                    label: {
                      value: "SSIM",
                      angle: -90,
                      position: "insideLeft",
                    },
                  })}
              domain={[0, 1]}
              tickFormatter={(value: number) => value.toFixed(2)}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
              }}
            />
            {MODELS.map((model) => (
              <Line
                key={model.key}
                dataKey={model.key}
                type="monotone"
                stroke={`var(--color-${model.key})`}
                strokeWidth={2}
                dot={false}
                name={model.displayName}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
