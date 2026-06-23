export interface StatCardCell {
  label: string;
  value: string;
}

export interface StatCardRow {
  left: StatCardCell;
  right?: StatCardCell;
}

export interface StatCardModel {
  emptyText?: string;
  rows: StatCardRow[];
}

export interface TextPanelModel {
  caption?: string;
  emptyText?: string;
  rows: string[];
}

const OUTER_PADDING = 4;
const INNER_PADDING = 6;
const COLUMN_GAP = 10;
const ROW_HEIGHT = 16;
const VALUE_GAP = 6;
const CAPTION_GAP = 18;
const TEXT_PANEL_ROW_HEIGHT = 14;
const TEXT_PANEL_MIN_ROW_HEIGHT = 10;

export function drawStatCard(
  widget: CustomWidget,
  graphics: GraphicsContext,
  model: StatCardModel
): void {
  graphics.colour = widget.window.colours[1] ?? 1;
  graphics.well(0, 0, widget.width, widget.height);

  const innerWidth = Math.max(0, widget.width - OUTER_PADDING * 2);
  const innerHeight = Math.max(0, widget.height - OUTER_PADDING * 2);
  graphics.clip(OUTER_PADDING, OUTER_PADDING, innerWidth, innerHeight);

  if (model.rows.length === 0) {
    graphics.text(
      `{BLACK}${trimTextToWidth(graphics, model.emptyText ?? "No data available.", innerWidth - INNER_PADDING * 2)}`,
      OUTER_PADDING + INNER_PADDING,
      OUTER_PADDING + INNER_PADDING
    );
    return;
  }

  const columnWidth = Math.max(
    80,
    Math.floor((innerWidth - INNER_PADDING * 2 - COLUMN_GAP) / 2)
  );
  const leftColumnX = OUTER_PADDING + INNER_PADDING;
  const rightColumnX = leftColumnX + columnWidth + COLUMN_GAP;

  for (let index = 0; index < model.rows.length; index += 1) {
    const row = model.rows[index];
    if (!row) {
      continue;
    }
    const y = OUTER_PADDING + INNER_PADDING + index * ROW_HEIGHT;
    if (y + ROW_HEIGHT > widget.height - OUTER_PADDING) {
      break;
    }

    drawCell(graphics, row.left, leftColumnX, y, columnWidth);
    if (row.right) {
      drawCell(graphics, row.right, rightColumnX, y, columnWidth);
    }
  }
}

export function drawTextPanel(
  widget: CustomWidget,
  graphics: GraphicsContext,
  model: TextPanelModel
): void {
  graphics.colour = widget.window.colours[1] ?? 1;
  graphics.well(0, 0, widget.width, widget.height);

  const innerWidth = Math.max(0, widget.width - OUTER_PADDING * 2);
  const innerHeight = Math.max(0, widget.height - OUTER_PADDING * 2);
  graphics.clip(OUTER_PADDING, OUTER_PADDING, innerWidth, innerHeight);

  let startY = OUTER_PADDING + INNER_PADDING;
  if (model.caption) {
    graphics.text(
      `{BLACK}${trimTextToWidth(graphics, model.caption, innerWidth - INNER_PADDING * 2)}`,
      OUTER_PADDING + INNER_PADDING,
      startY
    );
    startY += CAPTION_GAP;
  }

  const rows = model.rows.filter((row) => row.trim().length > 0);
  if (rows.length === 0) {
    graphics.text(
      `{BLACK}${trimTextToWidth(graphics, model.emptyText ?? "No data available.", innerWidth - INNER_PADDING * 2)}`,
      OUTER_PADDING + INNER_PADDING,
      startY
    );
    return;
  }

  const availableHeight = Math.max(0, widget.height - OUTER_PADDING - startY);
  const maxRows = Math.max(1, Math.floor(availableHeight / TEXT_PANEL_MIN_ROW_HEIGHT));
  const hasOverflow = rows.length > maxRows;
  const visibleRows = hasOverflow
    ? [
        ...rows.slice(0, Math.max(0, maxRows - 1)),
        `... ${rows.length - Math.max(0, maxRows - 1)} more`,
      ]
    : rows;
  const rowHeight = hasOverflow
    ? TEXT_PANEL_MIN_ROW_HEIGHT
    : Math.max(
        TEXT_PANEL_MIN_ROW_HEIGHT,
        Math.min(TEXT_PANEL_ROW_HEIGHT, Math.floor(availableHeight / visibleRows.length))
      );

  for (let index = 0; index < visibleRows.length; index += 1) {
    const row = visibleRows[index];
    if (!row) {
      continue;
    }

    const y = startY + index * rowHeight;
    if (y + rowHeight > widget.height - OUTER_PADDING) {
      break;
    }

    graphics.text(
      `{BLACK}${trimTextToWidth(graphics, row, innerWidth - INNER_PADDING * 2)}`,
      OUTER_PADDING + INNER_PADDING,
      y
    );
  }
}

function drawCell(
  graphics: GraphicsContext,
  cell: StatCardCell,
  x: number,
  y: number,
  width: number
): void {
  const naturalLabelWidth = graphics.measureText(`${cell.label}:`).width + 4;
  const labelAreaWidth = Math.min(
    Math.max(56, Math.floor(width * 0.62)),
    Math.max(56, naturalLabelWidth)
  );
  const valueAreaWidth = Math.max(36, width - labelAreaWidth - VALUE_GAP);
  const label = trimTextToWidth(graphics, `${cell.label}:`, labelAreaWidth);
  const value = trimTextToWidth(graphics, cell.value, valueAreaWidth);
  graphics.text(`{BLACK}${label}`, x, y);
  graphics.text(
    `{BLACK}${value}`,
    x + labelAreaWidth + VALUE_GAP,
    y
  );
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
