import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchMutation, getServerSecret } from "@/lib/convex";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateMacroChartProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

const FRED_SERIES_META: Record<
  string,
  { name: string; units: string; frequency: string }
> = {
  FEDFUNDS: {
    name: "Effective Federal Funds Rate",
    units: "Percent",
    frequency: "Monthly",
  },
  CPIAUCSL: {
    name: "Consumer Price Index (All Urban)",
    units: "Index 1982-84=100",
    frequency: "Monthly",
  },
  UNRATE: { name: "Unemployment Rate", units: "Percent", frequency: "Monthly" },
  DGS10: {
    name: "10-Year Treasury Yield",
    units: "Percent",
    frequency: "Daily",
  },
  DGS2: {
    name: "2-Year Treasury Yield",
    units: "Percent",
    frequency: "Daily",
  },
  DCOILWTICO: {
    name: "WTI Crude Oil Price",
    units: "Dollars per Barrel",
    frequency: "Daily",
  },
  SP500: { name: "S&P 500 Index", units: "Index", frequency: "Daily" },
};

const DAILY_SERIES = new Set(["DGS10", "DGS2", "DCOILWTICO", "SP500"]);

export const createMacroChart = ({
  session,
  dataStream,
}: CreateMacroChartProps) =>
  tool({
    description:
      "Create an interactive chart of macroeconomic data from the FRED (Federal Reserve Economic Data) database. Use this proactively when explaining market concepts that have relevant data — e.g. when discussing interest rates show the Fed funds rate, when discussing inflation show CPI, when discussing crude oil markets show WTI prices. Always create a chart when the user asks to 'show', 'chart', or 'visualize' economic data.",
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Display title for the chart, e.g. 'Federal Funds Rate (2019–2025)'"
        ),
      seriesId: z
        .enum([
          "FEDFUNDS",
          "CPIAUCSL",
          "UNRATE",
          "DGS10",
          "DGS2",
          "DCOILWTICO",
          "SP500",
        ])
        .describe(
          "FRED series ID: FEDFUNDS=Fed funds rate, CPIAUCSL=CPI inflation, UNRATE=unemployment rate, DGS10=10-year Treasury yield, DGS2=2-year Treasury yield, DCOILWTICO=WTI crude oil price, SP500=S&P 500 index"
        ),
      observationStart: z
        .string()
        .optional()
        .describe(
          "Start date in YYYY-MM-DD format. Defaults to 5 years ago. Use a longer range for historical context."
        ),
    }),
    execute: async ({ title, seriesId, observationStart }) => {
      const apiKey = process.env.FRED_API_KEY;
      if (!apiKey) {
        return {
          error:
            "FRED API key is not configured. Set FRED_API_KEY in environment variables.",
        };
      }

      const id = generateUUID();

      // Write artifact setup events so the panel opens immediately
      dataStream.write({ type: "data-kind", data: "chart", transient: true });
      dataStream.write({ type: "data-id", data: id, transient: true });
      dataStream.write({ type: "data-title", data: title, transient: true });
      dataStream.write({ type: "data-clear", data: null, transient: true });

      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const startDate =
        observationStart ?? fiveYearsAgo.toISOString().split("T")[0];

      // Aggregate daily series to monthly for cleaner charts
      const isDaily = DAILY_SERIES.has(seriesId);
      const params = new URLSearchParams({
        series_id: seriesId,
        api_key: apiKey,
        file_type: "json",
        observation_start: startDate,
        ...(isDaily ? { frequency: "m", aggregation_method: "avg" } : {}),
      });

      const response = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?${params}`
      );

      if (!response.ok) {
        return {
          error: `Failed to fetch FRED data: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();

      const observations = (
        data.observations as Array<{ date: string; value: string }>
      )
        .filter((o) => o.value !== ".")
        .map((o) => ({
          date: o.date.slice(0, 7), // YYYY-MM
          value: Number.parseFloat(o.value),
        }));

      if (observations.length === 0) {
        return {
          error:
            "No observations were returned for that series and date range. Try an earlier start date.",
        };
      }

      const latest = observations.at(-1);
      if (!latest) {
        return {
          error: "Unable to read chart observations for this request.",
        };
      }

      const first = observations[0];
      const minPoint = observations.reduce((min, point) =>
        point.value < min.value ? point : min
      );
      const maxPoint = observations.reduce((max, point) =>
        point.value > max.value ? point : max
      );
      const absoluteChange = latest.value - first.value;
      const percentChange =
        first.value === 0 ? null : (absoluteChange / first.value) * 100;
      const trend =
        percentChange === null
          ? absoluteChange > 0
            ? "up"
            : absoluteChange < 0
              ? "down"
              : "flat"
          : percentChange > 1
            ? "up"
            : percentChange < -1
              ? "down"
              : "flat";

      const meta = FRED_SERIES_META[seriesId];
      const chartContent = JSON.stringify({
        title,
        seriesId,
        units: meta?.units ?? "",
        frequency: meta?.frequency ?? "",
        observations,
      });

      dataStream.write({
        type: "data-chartDelta",
        data: chartContent,
        transient: true,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      if (session?.user?.id) {
        const serverSecret = getServerSecret();
        await fetchMutation(api.documents.save, {
          documentId: id,
          title,
          content: chartContent,
          kind: "chart",
          userId: session.user.id as Id<"users">,
          serverSecret,
        });
      }

      return {
        id,
        title,
        seriesId,
        seriesName: meta?.name ?? seriesId,
        units: meta?.units ?? "",
        startDate: first.date,
        endDate: latest.date,
        startValue: first.value,
        latestValue: latest.value,
        minValue: minPoint.value,
        maxValue: maxPoint.value,
        absoluteChange,
        percentChange,
        trend,
        dataPoints: observations.length,
        content: "A chart was created and is now visible to the user.",
      };
    },
  });
