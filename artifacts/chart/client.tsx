"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { CopyIcon, LineChartIcon } from "@/components/icons";

type ChartObservation = { date: string; value: number };

type ChartData = {
  title: string;
  seriesId: string;
  units: string;
  frequency: string;
  observations: ChartObservation[];
};

type Metadata = any;

function parseChartContent(content: string): ChartData | null {
  if (!content) {
    return null;
  }
  try {
    return JSON.parse(content) as ChartData;
  } catch (_) {
    return null;
  }
}

function formatTick(date: string): string {
  // date is YYYY-MM, format as MMM 'YY
  const [year, month] = date.split("-");
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatTooltipDate(date: string): string {
  const [year, month] = date.split("-");
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const CustomTooltip = ({
  active,
  payload,
  label,
  units,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  units: string;
}) => {
  if (active && payload && payload.length && label) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
        <p className="text-xs text-muted-foreground">
          {formatTooltipDate(label)}
        </p>
        <p className="text-sm font-semibold text-foreground">
          {payload[0].value.toFixed(2)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {units}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

export const chartArtifact = new Artifact<"chart", Metadata>({
  kind: "chart",
  description: "Interactive macroeconomic data chart from FRED",
  initialize: () => null,
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-chartDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data as string,
        isVisible: draftArtifact.isVisible,
        status: "streaming",
      }));
    }
  },
  content: ({ content, status }) => {
    const chartData = parseChartContent(content);

    if (status === "streaming" && !chartData) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8">
          <div className="size-8 animate-pulse rounded-full bg-muted-foreground/20" />
          <p className="animate-pulse text-sm text-muted-foreground">
            Fetching economic data...
          </p>
        </div>
      );
    }

    if (!chartData || chartData.observations.length === 0) {
      return (
        <div className="flex h-full w-full items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">No data available.</p>
        </div>
      );
    }

    const { observations, units } = chartData;

    const tickInterval = Math.max(1, Math.floor(observations.length / 8));

    const minVal = Math.min(...observations.map((o) => o.value));
    const maxVal = Math.max(...observations.map((o) => o.value));
    const padding = (maxVal - minVal) * 0.05 || 0.5;

    return (
      <div className="flex h-full w-full flex-col gap-2 p-6">
        <div className="flex flex-col gap-1 pb-2">
          <h2 className="text-base font-semibold text-foreground">
            {chartData.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            Source: FRED · {chartData.seriesId} · {units}
          </p>
        </div>

        <div className="h-[420px] w-full md:h-[520px]">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart
              data={observations}
              margin={{ top: 4, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid
                opacity={0.5}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                axisLine={{ stroke: "var(--border)" }}
                dataKey="date"
                interval={tickInterval - 1}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={formatTick}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={[minVal - padding, maxVal + padding]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => v.toFixed(1)}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={<CustomTooltip units={units} />}
                cursor={{
                  stroke: "var(--foreground)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              <Line
                activeDot={{
                  r: 4,
                  fill: "var(--primary)",
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }}
                dataKey="value"
                dot={false}
                stroke="var(--primary)"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  },
  actions: [
    {
      icon: <CopyIcon size={18} />,
      description: "Copy data as JSON",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Chart data copied to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <LineChartIcon size={18} />,
      description: "Ask for a different time range",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Can you show this chart with a longer historical range, going back 10 years?",
            },
          ],
        });
      },
    },
  ],
});
