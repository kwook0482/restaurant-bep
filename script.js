(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const inputScreen = $("inputScreen");
  const resultScreen = $("resultScreen");
  const inputForm = $("inputForm");
  const formError = $("formError");

  const fields = {
    rent: $("rent"),
    labor: $("labor"),
    other: $("other"),
    variableRatio: $("variableRatio"),
    monthlySales: $("monthlySales")
  };

  const state = {
    rent: 200,
    labor: 300,
    other: 100,
    variableRatio: 35,
    monthlySales: 1500
  };

  const formatNumber = (value, digits = 0) =>
    Number(value).toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });

  const money = (value) => `${formatNumber(Math.round(value))}만원`;

  function readInputs() {
    for (const [key, input] of Object.entries(fields)) {
      const raw = input.value.trim();
      if (raw === "" || !Number.isFinite(Number(raw))) {
        throw new Error("모든 항목에 숫자를 입력해 주세요.");
      }
      state[key] = Number(raw);
    }

    if (state.rent < 0 || state.labor < 0 || state.other < 0 || state.monthlySales < 0) {
      throw new Error("금액은 0 이상으로 입력해 주세요.");
    }
    if (state.variableRatio < 0 || state.variableRatio >= 100) {
      throw new Error("비용 비율은 0 이상 100 미만으로 입력해 주세요.");
    }
  }

  function fixedCosts() {
    return state.rent + state.labor + state.other;
  }

  function calculations() {
    const fixed = fixedCosts();
    const ratio = state.variableRatio / 100;
    const contributionRate = 1 - ratio;
    const bep = contributionRate > 0 ? fixed / contributionRate : Infinity;
    const totalCost = fixed + state.monthlySales * ratio;
    const profit = state.monthlySales - totalCost;
    return { fixed, ratio, bep, totalCost, profit };
  }

  function updateFixedTotal() {
    const values = ["rent", "labor", "other"].map((key) => Number(fields[key].value) || 0);
    $("fixedTotal").textContent = `${formatNumber(values.reduce((a, b) => a + b, 0))}만원`;
  }

  function syncInputs() {
    for (const [key, input] of Object.entries(fields)) {
      input.value = String(state[key]);
    }
    updateFixedTotal();
  }

  function updateResult() {
    const result = calculations();
    $("bepValue").textContent = Number.isFinite(result.bep) ? money(result.bep) : "계산 불가";
    const profitEl = $("profitValue");
    profitEl.textContent = `${result.profit > 0 ? "+" : result.profit < 0 ? "−" : ""}${money(Math.abs(result.profit))}`;
    profitEl.classList.toggle("negative", result.profit < 0);

    if (result.profit > 0) {
      $("profitCaption").textContent = "입력한 비용 기준 흑자 예상";
    } else if (result.profit < 0) {
      $("profitCaption").textContent = "입력한 비용 기준 적자 예상";
    } else {
      $("profitCaption").textContent = "입력한 비용 기준 손익분기";
    }

    $("fixedValueLabel").textContent = `현재 ${money(result.fixed)}`;
    $("ratioValueLabel").textContent = `현재 ${formatNumber(state.variableRatio)}%`;
    $("salesValueLabel").textContent = `현재 ${money(state.monthlySales)}`;
    $("resultInputsSummary").textContent = `월 고정 지출 ${money(result.fixed)} · 매출 연동 비용 ${formatNumber(state.variableRatio)}% · 예상 매출 ${money(state.monthlySales)}`;
    drawChart(result);
  }

  function svgEl(name, attrs = {}, text = null) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, String(value));
    }
    if (text !== null) element.textContent = text;
    return element;
  }

  function drawChart(result) {
    const svg = $("bepChart");
    svg.replaceChildren();

    const W = 600;
    const H = 340;
    const margin = { left: 62, right: 22, top: 26, bottom: 54 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const safeBep = Number.isFinite(result.bep) ? result.bep : 0;
    const maxX = Math.max(500, state.monthlySales * 1.18, safeBep * 1.18, result.fixed * 1.4);
    const maxY = Math.max(maxX, result.fixed + maxX * result.ratio, state.monthlySales) * 1.08;

    const x = (v) => margin.left + (v / maxX) * plotW;
    const y = (v) => margin.top + plotH - (v / maxY) * plotH;

    // Background and grid
    svg.appendChild(svgEl("rect", {
      x: margin.left, y: margin.top, width: plotW, height: plotH,
      rx: 3, fill: "#fbfcfd"
    }));

    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const xv = (maxX / tickCount) * i;
      const yv = (maxY / tickCount) * i;
      const gx = x(xv);
      const gy = y(yv);

      svg.appendChild(svgEl("line", {
        x1: gx, y1: margin.top, x2: gx, y2: margin.top + plotH,
        stroke: "#e5e9ef", "stroke-width": 1
      }));
      svg.appendChild(svgEl("line", {
        x1: margin.left, y1: gy, x2: margin.left + plotW, y2: gy,
        stroke: "#e5e9ef", "stroke-width": 1
      }));
      svg.appendChild(svgEl("text", {
        x: gx, y: margin.top + plotH + 22, "text-anchor": "middle",
        fill: "#667085", "font-size": 11
      }, formatNumber(xv)));
      svg.appendChild(svgEl("text", {
        x: margin.left - 9, y: gy + 4, "text-anchor": "end",
        fill: "#667085", "font-size": 11
      }, formatNumber(yv)));
    }

    // Shade the area between revenue and total-cost lines.
    // Left of BEP is loss (light red); right of BEP is profit (light blue).
    if (Number.isFinite(result.bep)) {
      const bepX = Math.max(0, Math.min(maxX, result.bep));
      if (bepX > 0) {
        svg.appendChild(svgEl("polygon", {
          points: [
            `${x(0)},${y(0)}`,
            `${x(0)},${y(result.fixed)}`,
            `${x(bepX)},${y(bepX)}`
          ].join(" "),
          fill: "#FCE2E2", opacity: 0.9
        }));
      }
      if (bepX < maxX) {
        svg.appendChild(svgEl("polygon", {
          points: [
            `${x(bepX)},${y(bepX)}`,
            `${x(maxX)},${y(maxX)}`,
            `${x(maxX)},${y(result.fixed + maxX * result.ratio)}`
          ].join(" "),
          fill: "#DCEEFF", opacity: 0.9
        }));
      }
    }

    // Axis labels
    svg.appendChild(svgEl("text", {
      x: margin.left + plotW / 2, y: H - 12, "text-anchor": "middle",
      fill: "#475467", "font-size": 12, "font-weight": 600
    }, "월 매출 (만원)"));
    svg.appendChild(svgEl("text", {
      x: 15, y: margin.top - 8, fill: "#475467", "font-size": 11
    }, "금액"));

    // Revenue line: revenue = sales
    svg.appendChild(svgEl("line", {
      x1: x(0), y1: y(0), x2: x(maxX), y2: y(maxX),
      stroke: "#0d9488", "stroke-width": 3, "stroke-linecap": "round"
    }));

    // Total cost line: fixed costs + variable costs
    svg.appendChild(svgEl("line", {
      x1: x(0), y1: y(result.fixed), x2: x(maxX), y2: y(result.fixed + maxX * result.ratio),
      stroke: "#d97706", "stroke-width": 3, "stroke-linecap": "round"
    }));

    // Labels inside the shaded areas make the graph easier to read at a glance.
    const lossLabelXValue = Number.isFinite(result.bep)
      ? Math.max(0, Math.min(maxX * 0.24, result.bep * 0.72))
      : maxX * 0.24;
    const lossGap = result.fixed - lossLabelXValue * (1 - result.ratio);
    if (result.fixed > 0 && lossLabelXValue < result.bep && lossGap > maxY * 0.035) {
      svg.appendChild(svgEl("text", {
        x: x(lossLabelXValue),
        y: (y(lossLabelXValue) + y(result.fixed + lossLabelXValue * result.ratio)) / 2,
        "text-anchor": "middle", "dominant-baseline": "middle",
        fill: "#A52B2B", "font-size": 15, "font-weight": 700
      }, "손실"));
    }

    const profitLabelXValue = Math.max(
      Number.isFinite(result.bep) ? result.bep + (maxX - result.bep) * 0.45 : maxX * 0.65,
      maxX * 0.52
    );
    if (profitLabelXValue < maxX) {
      const profitGap = profitLabelXValue * (1 - result.ratio) - result.fixed;
      if (profitGap > maxY * 0.035) {
        svg.appendChild(svgEl("text", {
          x: x(profitLabelXValue),
          y: (y(profitLabelXValue) + y(result.fixed + profitLabelXValue * result.ratio)) / 2,
          "text-anchor": "middle", "dominant-baseline": "middle",
          fill: "#245A91", "font-size": 15, "font-weight": 700
        }, "이익"));
      }
    }

    // Break-even marker
    if (Number.isFinite(result.bep) && result.bep <= maxX) {
      const bx = x(result.bep);
      const by = y(result.bep);
      svg.appendChild(svgEl("line", {
        x1: bx, y1: by, x2: bx, y2: margin.top + plotH,
        stroke: "#64748b", "stroke-width": 1.7, "stroke-dasharray": "5 5"
      }));
      svg.appendChild(svgEl("circle", {
        cx: bx, cy: by, r: 5, fill: "#64748b", stroke: "#fff", "stroke-width": 2
      }));
      const labelX = bx > W * 0.68 ? bx - 8 : bx + 8;
      svg.appendChild(svgEl("text", {
        x: labelX, y: Math.max(margin.top + 13, by - 12),
        "text-anchor": bx > W * 0.68 ? "end" : "start",
        fill: "#475467", "font-size": 11, "font-weight": 700
      }, "손익분기점"));
    }

    // Current monthly sales marker on revenue line
    const sx = x(Math.min(state.monthlySales, maxX));
    const sy = y(Math.min(state.monthlySales, maxY));
    svg.appendChild(svgEl("line", {
      x1: sx, y1: sy, x2: sx, y2: margin.top + plotH,
      stroke: "#0d9488", "stroke-width": 1.7, "stroke-dasharray": "4 5", opacity: 0.85
    }));
    svg.appendChild(svgEl("circle", {
      cx: sx, cy: sy, r: 5.5, fill: "#0d9488", stroke: "#fff", "stroke-width": 2
    }));
    const currentLabelX = sx > W * 0.72 ? sx - 8 : sx + 8;
    svg.appendChild(svgEl("text", {
      x: currentLabelX, y: Math.max(margin.top + 13, sy - 12),
      "text-anchor": sx > W * 0.72 ? "end" : "start",
      fill: "#0d766e", "font-size": 11, "font-weight": 700
    }, "예상 매출"));
  }

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function hideError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function showResults() {
    inputScreen.hidden = true;
    resultScreen.hidden = false;
    updateResult();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showInputs() {
    syncInputs();
    resultScreen.hidden = true;
    inputScreen.hidden = false;
    hideError();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  inputForm.addEventListener("submit", (event) => {
    event.preventDefault();
    hideError();
    try {
      readInputs();
      syncInputs();
      showResults();
    } catch (error) {
      showError(error.message || "입력값을 확인해 주세요.");
    }
  });

  // Keep the fixed-cost subtotal current while the user edits inputs.
  ["rent", "labor", "other"].forEach((key) => {
    fields[key].addEventListener("input", updateFixedTotal);
  });

  document.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.adjust;
      const step = Number(button.dataset.step);

      if (type === "fixed") {
        // Adjust the combined fixed cost. When reducing, lower other costs first,
        // then labor, then rent, without allowing any individual field below zero.
        let remaining = step;
        if (remaining > 0) {
          state.other += remaining;
        } else {
          remaining = -remaining;
          const reduceOther = Math.min(state.other, remaining);
          state.other -= reduceOther;
          remaining -= reduceOther;

          const reduceLabor = Math.min(state.labor, remaining);
          state.labor -= reduceLabor;
          remaining -= reduceLabor;

          const reduceRent = Math.min(state.rent, remaining);
          state.rent -= reduceRent;
        }
      } else if (type === "ratio") {
        state.variableRatio = Math.min(90, Math.max(0, state.variableRatio + step));
      } else if (type === "sales") {
        state.monthlySales = Math.max(0, state.monthlySales + step);
      }

      syncInputs();
      updateResult();
    });
  });

  $("backButton").addEventListener("click", showInputs);
  $("editButton").addEventListener("click", showInputs);

  updateFixedTotal();
})();
