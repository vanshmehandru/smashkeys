// In-house SVG Charting Module for typing speed and accuracy graphing
export function renderAnalyticsChart(containerId, history) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear previous contents
  container.innerHTML = '';

  // If not enough data, display fallback notice
  if (!history || history.length < 2) {
    container.innerHTML = `<div class="chart-fallback">Start typing to populate performance graph...</div>`;
    return;
  }

  const width = 800;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // 1. Math Bounds
  const maxWpm = Math.max(...history.map(d => d.wpm), 40); // At least show up to 40
  const minWpm = 0;
  
  const count = history.length;
  
  // Coordinate transformers
  const getX = (index) => paddingLeft + (index / (count - 1)) * chartW;
  const getY_wpm = (wpm) => height - paddingBottom - (wpm / maxWpm) * chartH;
  const getY_acc = (acc) => height - paddingBottom - (acc / 100) * chartH;

  // 2. Build SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.overflow = 'visible';

  // Gradient & Glow Definitions
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  // WPM fill gradient
  const gradWpm = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradWpm.setAttribute('id', 'grad-wpm');
  gradWpm.setAttribute('x1', '0');
  gradWpm.setAttribute('y1', '0');
  gradWpm.setAttribute('x2', '0');
  gradWpm.setAttribute('y2', '1');
  
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', 'var(--accent-color)');
  stop1.setAttribute('stop-opacity', '0.25');
  
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', 'var(--accent-color)');
  stop2.setAttribute('stop-opacity', '0.0');

  gradWpm.appendChild(stop1);
  gradWpm.appendChild(stop2);
  defs.appendChild(gradWpm);

  // WPM line glow filter
  const filterGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filterGlow.setAttribute('id', 'neon-glow');
  filterGlow.setAttribute('x', '-10%');
  filterGlow.setAttribute('y', '-10%');
  filterGlow.setAttribute('width', '120%');
  filterGlow.setAttribute('height', '120%');
  
  const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  blur.setAttribute('stdDeviation', '4');
  blur.setAttribute('result', 'coloredBlur');
  
  const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  mergeNode1.setAttribute('in', 'coloredBlur');
  const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  mergeNode2.setAttribute('in', 'SourceGraphic');
  
  merge.appendChild(mergeNode1);
  merge.appendChild(mergeNode2);
  filterGlow.appendChild(blur);
  filterGlow.appendChild(merge);
  defs.appendChild(filterGlow);
  
  svg.appendChild(defs);

  // 3. Grid Lines (Horizontal)
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const ratio = i / gridSteps;
    const yVal = height - paddingBottom - ratio * chartH;
    const wpmVal = Math.round(ratio * maxWpm);
    const accVal = Math.round(ratio * 100);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', paddingLeft);
    line.setAttribute('y1', yVal);
    line.setAttribute('x2', width - paddingRight);
    line.setAttribute('y2', yVal);
    line.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    line.setAttribute('stroke-dasharray', '4, 4');
    svg.appendChild(line);

    // Left Y Axis labels (WPM)
    const labelWpm = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelWpm.setAttribute('x', paddingLeft - 10);
    labelWpm.setAttribute('y', yVal + 4);
    labelWpm.setAttribute('text-anchor', 'end');
    labelWpm.setAttribute('fill', 'var(--text-muted)');
    labelWpm.style.fontSize = '10px';
    labelWpm.style.fontFamily = 'monospace';
    labelWpm.textContent = wpmVal;
    svg.appendChild(labelWpm);

    // Right Y Axis labels (Accuracy)
    const labelAcc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelAcc.setAttribute('x', width - paddingRight + 10);
    labelAcc.setAttribute('y', yVal + 4);
    labelAcc.setAttribute('text-anchor', 'start');
    labelAcc.setAttribute('fill', 'var(--text-muted)');
    labelAcc.style.fontSize = '10px';
    labelAcc.style.fontFamily = 'monospace';
    labelAcc.textContent = `${accVal}%`;
    svg.appendChild(labelAcc);
  }

  // 4. Draw Lines & Paths
  let pathWpmData = '';
  let pathAccData = '';
  let pathAreaWpm = `M ${getX(0)} ${height - paddingBottom} `;

  history.forEach((d, idx) => {
    const x = getX(idx);
    const yWpm = getY_wpm(d.wpm);
    const yAcc = getY_acc(d.acc);

    const cmd = idx === 0 ? 'M' : 'L';
    pathWpmData += `${cmd} ${x} ${yWpm} `;
    pathAccData += `${cmd} ${x} ${yAcc} `;
    pathAreaWpm += `L ${x} ${yWpm} `;
  });

  pathAreaWpm += `L ${getX(count - 1)} ${height - paddingBottom} Z`;

  // WPM Gradient Area
  const areaWpmPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  areaWpmPath.setAttribute('d', pathAreaWpm);
  areaWpmPath.setAttribute('fill', 'url(#grad-wpm)');
  svg.appendChild(areaWpmPath);

  // WPM Line path
  const lineWpmPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  lineWpmPath.setAttribute('d', pathWpmData);
  lineWpmPath.setAttribute('fill', 'none');
  lineWpmPath.setAttribute('stroke', 'var(--accent-color)');
  lineWpmPath.setAttribute('stroke-width', '2.5');
  lineWpmPath.setAttribute('filter', 'url(#neon-glow)');
  svg.appendChild(lineWpmPath);

  // Accuracy Line path
  const lineAccPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  lineAccPath.setAttribute('d', pathAccData);
  lineAccPath.setAttribute('fill', 'none');
  lineAccPath.setAttribute('stroke', 'var(--accent-secondary)');
  lineAccPath.setAttribute('stroke-width', '1.5');
  lineAccPath.setAttribute('stroke-dasharray', '3, 3');
  svg.appendChild(lineAccPath);

  // 5. X Axis bottom labels (Seconds)
  const xLabelsCount = Math.min(count, 10);
  for (let i = 0; i < xLabelsCount; i++) {
    const index = Math.round((i / (xLabelsCount - 1)) * (count - 1));
    const d = history[index];
    if (!d) continue;
    
    const x = getX(index);
    const labelX = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelX.setAttribute('x', x);
    labelX.setAttribute('y', height - 10);
    labelX.setAttribute('text-anchor', 'middle');
    labelX.setAttribute('fill', 'var(--text-muted)');
    labelX.style.fontSize = '10px';
    labelX.style.fontFamily = 'monospace';
    labelX.textContent = `${d.time}s`;
    svg.appendChild(labelX);
  }

  // 6. Interaction nodes & tooltips
  history.forEach((d, idx) => {
    const x = getX(idx);
    const yWpm = getY_wpm(d.wpm);
    const yAcc = getY_acc(d.acc);

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('chart-node-group');

    // Invisible larger trigger circle for easier hover
    const trigger = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    trigger.setAttribute('cx', x);
    trigger.setAttribute('cy', yWpm);
    trigger.setAttribute('r', '12');
    trigger.setAttribute('fill', 'transparent');
    trigger.style.cursor = 'pointer';

    // Visual dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', yWpm);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', 'var(--accent-color)');
    dot.setAttribute('stroke', 'var(--bg-color)');
    dot.setAttribute('stroke-width', '1');

    // Tooltip elements
    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tooltip.setAttribute('visibility', 'hidden');
    tooltip.style.pointerEvents = 'none';

    // Tooltip rect background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - 50);
    rect.setAttribute('y', yWpm - 45);
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '32');
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', 'var(--bg-color)');
    rect.setAttribute('stroke', 'var(--border-focus)');
    rect.setAttribute('stroke-width', '1');

    // Tooltip text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', yWpm - 25);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'var(--text-main)');
    text.style.fontSize = '9px';
    text.style.fontFamily = 'monospace';
    text.textContent = `${Math.round(d.wpm)} WPM / ${Math.round(d.acc)}%`;

    tooltip.appendChild(rect);
    tooltip.appendChild(text);

    group.appendChild(dot);
    group.appendChild(tooltip);
    group.appendChild(trigger);

    // Hover event logic
    trigger.addEventListener('mouseenter', () => {
      tooltip.setAttribute('visibility', 'visible');
      dot.setAttribute('r', '6');
      dot.setAttribute('fill', 'var(--accent-secondary)');
    });
    
    trigger.addEventListener('mouseleave', () => {
      tooltip.setAttribute('visibility', 'hidden');
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', 'var(--accent-color)');
    });

    svg.appendChild(group);
  });

  container.appendChild(svg);
}

// Generate the Keyboard Heatmap
export function renderKeyboardHeatmap(containerId, errorKeys, layout = 'qwerty') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const keyboardLayouts = {
    qwerty: [
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
      ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
      ["space"]
    ],
    dvorak: [
      ["'", ",", ".", "p", "y", "f", "g", "c", "r", "l"],
      ["a", "o", "e", "u", "i", "d", "h", "t", "n", "s"],
      [";", "q", "j", "k", "x", "b", "m", "w", "v", "z"],
      ["space"]
    ],
    colemak: [
      ["q", "w", "f", "p", "g", "j", "l", "u", "y", ";"],
      ["a", "r", "s", "t", "d", "h", "n", "e", "i", "o"],
      ["z", "x", "c", "v", "b", "k", "m", ",", ".", "/"],
      ["space"]
    ]
  };

  const selectedLayout = keyboardLayouts[layout] || keyboardLayouts.qwerty;

  // Find max errors to scale background glow opacity
  const errorVals = Object.values(errorKeys);
  const maxErrors = errorVals.length > 0 ? Math.max(...errorVals) : 1;

  selectedLayout.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'keyboard-row';

    row.forEach(keyChar => {
      const keyDiv = document.createElement('div');
      keyDiv.className = 'key';
      keyDiv.textContent = keyChar.toUpperCase();

      if (keyChar === 'space') {
        keyDiv.className = 'key space-key';
        keyDiv.textContent = 'SPACE';
      }

      // Check errors for this key
      const errors = errorKeys[keyChar.toLowerCase()] || 0;
      if (errors > 0) {
        const ratio = errors / maxErrors;
        // Cyberpunk styling: red/orange glow scaled by error ratio
        keyDiv.style.background = `rgba(255, 59, 59, ${0.05 + ratio * 0.45})`;
        keyDiv.style.borderColor = `rgba(255, 59, 59, ${0.2 + ratio * 0.6})`;
        keyDiv.style.color = '#ff8888';
        keyDiv.style.boxShadow = `0 0 ${Math.round(ratio * 12)}px rgba(255, 59, 59, ${ratio * 0.4})`;
      }

      rowDiv.appendChild(keyDiv);
    });

    container.appendChild(rowDiv);
  });
}
