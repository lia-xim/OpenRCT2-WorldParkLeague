export interface TrendChartSeries {
  label: string;
  values: number[];
}

export interface TrendChartMarker {
  position: number;
  label: string;
  severity: "info" | "success" | "warning";
}

export interface TrendChartModel {
  caption?: string;
  metricLabel: string;
  summaryRows: string[];
  series: TrendChartSeries[];
  markers?: TrendChartMarker[];
  emptyText?: string;
  lowerIsBetter?: boolean;
}

const OUTER_PADDING = 4;
const INNER_PADDING = 6;
const CAPTION_GAP = 16;
const LEGEND_GAP = 14;
const SUMMARY_ROW_HEIGHT = 13;
const SUMMARY_ROWS = 4;

export function drawTrendChart(
  widget: CustomWidget,
  graphics: GraphicsContext,
  model: TrendChartModel
): void {
  graphics.colour = widget.window.colours[1] ?? 1;
  graphics.well(0, 0, widget.width, widget.height);

  const innerWidth = Math.max(0, widget.width - OUTER_PADDING * 2);
  const innerHeight = Math.max(0, widget.height - OUTER_PADDING * 2);
  graphics.clip(OUTER_PADDING, OUTER_PADDING, innerWidth, innerHeight);

  let currentY = OUTER_PADDING + INNER_PADDING;
  const textWidth = innerWidth - INNER_PADDING * 2;

  if (model.caption) {
    graphics.text(
      `{BLACK}${trimTextToWidth(graphics, model.caption, textWidth)}`,
      OUTER_PADDING + INNER_PADDING,
      currentY
    );
    currentY += CAPTION_GAP;
  }

  graphics.text(
    `{BLACK}${trimTextToWidth(graphics, model.metricLabel, textWidth)}`,
    OUTER_PADDING + INNER_PADDING,
    currentY
  );
  currentY += LEGEND_GAP;

  drawLegend(widget, graphics, model.series, currentY, textWidth);
  currentY += LEGEND_GAP;

  const chartBottom = widget.height - OUTER_PADDING - INNER_PADDING - SUMMARY_ROWS * SUMMARY_ROW_HEIGHT - 4;
  const chartHeight = Math.max(48, chartBottom - currentY);
  const chartX = OUTER_PADDING + INNER_PADDING;
  const chartY = currentY;
  const chartWidth = Math.max(48, innerWidth - INNER_PADDING * 2);

  drawChartFrame(widget, graphics, chartX, chartY, chartWidth, chartHeight);
  drawMarkers(widget, graphics, model.markers ?? [], chartX, chartY, chartWidth, chartHeight);
  drawSeries(widget, graphics, model, chartX, chartY, chartWidth, chartHeight);

  const summaryStartY = chartY + chartHeight + 6;
  const rows =
    model.summaryRows.length > 0
      ? model.summaryRows.slice(0, SUMMARY_ROWS)
      : [model.emptyText ?? "No trend data recorded yet."];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }

    graphics.text(
      `{BLACK}${trimTextToWidth(graphics, row, textWidth)}`,
      OUTER_PADDING + INNER_PADDING,
      summaryStartY + index * SUMMARY_ROW_HEIGHT
    );
  }
}

function drawMarkers(
  widget: CustomWidget,
  graphics: GraphicsContext,
  markers: TrendChartMarker[],
  x: number,
  y: number,
  width: number,
  height: number
): void {
  for (const marker of markers) {
    const markerX = x + Math.round(Math.max(0, Math.min(1, marker.position)) * Math.max(1, width - 2)) + 1;
    graphics.colour = getMarkerColour(widget, marker.severity);
    graphics.line(markerX, y + height - 10, markerX, y + height - 2);
  }
}

function drawLegend(
  widget: CustomWidget,
  graphics: GraphicsContext,
  series: TrendChartSeries[],
  y: number,
  maxWidth: number
): void {
  let cursorX = OUTER_PADDING + INNER_PADDING;
  const maxItems = Math.min(2, series.length);
  for (let index = 0; index < maxItems; index += 1) {
    const item = series[index];
    if (!item) {
      continue;
    }

    graphics.colour = getSeriesColour(widget, index);
    graphics.line(cursorX, y + 4, cursorX + 10, y + 4);
    cursorX += 14;

    const label = trimTextToWidth(graphics, item.label, Math.max(36, maxWidth - cursorX));
    graphics.text(`{BLACK}${label}`, cursorX, y - 2);
    cursorX += graphics.measureText(label).width + 16;
  }
}

function drawChartFrame(
  widget: CustomWidget,
  graphics: GraphicsContext,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  graphics.colour = widget.window.colours[2] ?? widget.window.colours[0] ?? 1;
  graphics.rect(x, y, width, height);

  const segmentHeight = Math.max(1, Math.floor(height / 3));
  for (let index = 1; index <= 2; index += 1) {
    const gridY = y + segmentHeight * index;
    graphics.line(x + 1, gridY, x + width - 2, gridY);
  }
}

function drawSeries(
  widget: CustomWidget,
  graphics: GraphicsContext,
  model: TrendChartModel,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const populatedSeries = model.series.filter((item) => item.values.length > 0);
  if (populatedSeries.length === 0) {
    return;
  }

  const values = populatedSeries.flatMap((item) => item.values);
  const rawMin = values.reduce((lowest, value) => Math.min(lowest, value), values[0] ?? 0);
  const rawMax = values.reduce((highest, value) => Math.max(highest, value), values[0] ?? 0);
  const rangePadding = rawMin === rawMax ? Math.max(1, Math.abs(rawMax) * 0.08) : Math.abs(rawMax - rawMin) * 0.08;
  const minValue = rawMin - rangePadding;
  const maxValue = rawMax + rangePadding;
  const range = Math.max(0.0001, maxValue - minValue);
  const orientation = model.lowerIsBetter ? -1 : 1;

  for (let seriesIndex = 0; seriesIndex < populatedSeries.length; seriesIndex += 1) {
    const series = populatedSeries[seriesIndex];
    if (!series) {
      continue;
    }

    graphics.colour = getSeriesColour(widget, seriesIndex);
    if (series.values.length === 1) {
      const singleX = x + Math.floor(width / 2);
      const singleY = mapValueToY(series.values[0] ?? 0, minValue, range, y, height, orientation);
      graphics.line(singleX - 1, singleY, singleX + 1, singleY);
      graphics.line(singleX, singleY - 1, singleX, singleY + 1);
      continue;
    }

    for (let index = 1; index < series.values.length; index += 1) {
      const previousValue = series.values[index - 1] ?? 0;
      const currentValue = series.values[index] ?? 0;
      const previousX = mapPointToX(index - 1, series.values.length, x, width);
      const currentX = mapPointToX(index, series.values.length, x, width);
      const previousY = mapValueToY(previousValue, minValue, range, y, height, orientation);
      const currentY = mapValueToY(currentValue, minValue, range, y, height, orientation);
      graphics.line(previousX, previousY, currentX, currentY);
    }
  }
}

function mapPointToX(index: number, totalPoints: number, x: number, width: number): number {
  if (totalPoints <= 1) {
    return x + Math.floor(width / 2);
  }

  return x + Math.round((index / (totalPoints - 1)) * Math.max(1, width - 2)) + 1;
}

function mapValueToY(
  value: number,
  minValue: number,
  range: number,
  y: number,
  height: number,
  orientation: number
): number {
  const normalized = Math.max(0, Math.min(1, (value - minValue) / range));
  const scaled = orientation > 0 ? normalized : 1 - normalized;
  return y + Math.round((1 - scaled) * Math.max(1, height - 2)) + 1;
}

function getSeriesColour(widget: CustomWidget, index: number): number {
  if (index === 0) {
    return widget.window.colours[2] ?? widget.window.colours[0] ?? 1;
  }

  return widget.window.colours[0] ?? widget.window.colours[2] ?? 1;
}

function getMarkerColour(
  widget: CustomWidget,
  severity: TrendChartMarker["severity"]
): number {
  if (severity === "success") {
    return widget.window.colours[3] ?? widget.window.colours[2] ?? 1;
  }
  if (severity === "warning") {
    return widget.window.colours[4] ?? widget.window.colours[0] ?? 1;
  }

  return widget.window.colours[0] ?? widget.window.colours[2] ?? 1;
}

function trimTextToWidth(
  graphics: GraphicsContext,
  value: string,
  maxWidth: number
): string {
  if (graphics.measureText(value).width <= maxWidth) {
    return value;
  }

  for (let length = value.length - 1; length > 0; length -= 1) {
    const candidate = `${value.slice(0, Math.max(0, length - 3))}...`;
    if (graphics.measureText(candidate).width <= maxWidth) {
      return candidate;
    }
  }

  return "...";
}
