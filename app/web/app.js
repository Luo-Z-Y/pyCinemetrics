const state = {
  file: null,
  url: null,
  meta: null,
  analysis: null,
};

const refs = {
  videoFile: document.getElementById("videoFile"),
  fileTitle: document.getElementById("fileTitle"),
  fileMeta: document.getElementById("fileMeta"),
  sampleInterval: document.getElementById("sampleInterval"),
  sampleIntervalOut: document.getElementById("sampleIntervalOut"),
  sceneSensitivity: document.getElementById("sceneSensitivity"),
  sceneSensitivityOut: document.getElementById("sceneSensitivityOut"),
  backendUrl: document.getElementById("backendUrl"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  openShotDataBtn: document.getElementById("openShotDataBtn"),
  openColorBtn: document.getElementById("openColorBtn"),
  openObjectsBtn: document.getElementById("openObjectsBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportScenesCsvBtn: document.getElementById("exportScenesCsvBtn"),
  exportShotsCsvBtn: document.getElementById("exportShotsCsvBtn"),
  generateLlmDraftBtn: document.getElementById("generateLlmDraftBtn"),
  llmDraftWrap: document.getElementById("llmDraftWrap"),
  llmDraftText: document.getElementById("llmDraftText"),
  statusText: document.getElementById("statusText"),
  progressBar: document.getElementById("progressBar"),
  previewVideo: document.getElementById("previewVideo"),
  analysisVideo: document.getElementById("analysisVideo"),
  analysisCanvas: document.getElementById("analysisCanvas"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  views: {
    overview: document.getElementById("view-overview"),
    shotdata: document.getElementById("view-shotdata"),
    color: document.getElementById("view-color"),
    objects: document.getElementById("view-objects"),
  },
  placeholders: {
    overview: document.getElementById("overviewPlaceholder"),
    shotdata: document.getElementById("shotdataPlaceholder"),
    color: document.getElementById("colorPlaceholder"),
    objects: document.getElementById("objectsPlaceholder"),
  },
  contents: {
    overview: document.getElementById("overviewContent"),
    shotdata: document.getElementById("shotdataContent"),
    color: document.getElementById("colorContent"),
    objects: document.getElementById("objectsContent"),
  },
};

setup();

function setup() {
  refs.sampleInterval.addEventListener("input", () => {
    refs.sampleIntervalOut.value = `${Number(refs.sampleInterval.value).toFixed(2)}s`;
  });
  refs.sceneSensitivity.addEventListener("input", () => {
    refs.sceneSensitivityOut.value = refs.sceneSensitivity.value;
  });

  refs.videoFile.addEventListener("change", onFileSelected);
  refs.analyzeBtn.addEventListener("click", onAnalyze);
  refs.openShotDataBtn.addEventListener("click", () => setActiveView("shotdata"));
  refs.openColorBtn.addEventListener("click", () => setActiveView("color"));
  refs.openObjectsBtn.addEventListener("click", () => setActiveView("objects"));
  refs.exportJsonBtn.addEventListener("click", exportAnalysisJson);
  refs.exportScenesCsvBtn.addEventListener("click", exportScenesCsv);
  refs.exportShotsCsvBtn.addEventListener("click", exportShotsCsv);
  refs.generateLlmDraftBtn.addEventListener("click", generateLlmDraft);

  refs.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveView(tab.dataset.view));
  });

  setFeatureButtonsEnabled(false);
}

function setActiveView(viewKey) {
  refs.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewKey));
  Object.entries(refs.views).forEach(([key, view]) => {
    view.classList.toggle("active", key === viewKey);
  });
}

function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (state.url) {
    URL.revokeObjectURL(state.url);
  }

  state.file = file;
  state.analysis = null;
  state.meta = null;

  const url = URL.createObjectURL(file);
  state.url = url;

  refs.fileTitle.textContent = file.name;
  refs.fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "video/*"}`;
  refs.previewVideo.src = url;
  refs.analysisVideo.src = url;

  clearAnalysisViews();
  setFeatureButtonsEnabled(false);
  refs.analyzeBtn.disabled = true;
  setStatus("Reading metadata...");
  setProgress(0);

  refs.analysisVideo.onloadedmetadata = () => {
    state.meta = buildVideoMeta(file, refs.analysisVideo);
    refs.analyzeBtn.disabled = false;
    setStatus("Metadata ready. Generate analysis when ready.");
    setProgress(0);
    renderOverviewMetadataOnly(state.meta);
  };
}

function buildVideoMeta(file, videoEl) {
  const durationSec = Number(videoEl.duration || 0);
  const fpsEstimated = estimateFps(durationSec);
  return {
    id: cryptoId(),
    filename: file.name,
    durationSec,
    width: Number(videoEl.videoWidth || 0),
    height: Number(videoEl.videoHeight || 0),
    frameCountEstimated: Math.round(durationSec * fpsEstimated),
    fpsEstimated,
    createdAt: new Date().toISOString(),
  };
}

function estimateFps(durationSec) {
  if (durationSec < 30) return 30;
  if (durationSec < 600) return 24;
  return 23.976;
}

async function onAnalyze() {
  if (!state.file || !state.meta) return;

  const interval = Number(refs.sampleInterval.value);
  const sensitivity = Number(refs.sceneSensitivity.value);
  const backendUrl = refs.backendUrl.value.trim();

  refs.analyzeBtn.disabled = true;
  setStatus("Sending video to backend...");
  setProgress(0);

  try {
    const apiResult = await analyzeViaBackend(backendUrl, state.file, sensitivity);
    const normalized = normalizeApiResult(apiResult, interval, sensitivity);
    state.meta = normalized.meta;
    state.analysis = normalized;

    setStatus("Analysis complete.");
    setProgress(100);

    renderAll(state.meta, state.analysis);
    setFeatureButtonsEnabled(true);
  } catch (err) {
    console.error(err);
    setStatus(`Analysis failed: ${err.message}`);
    setProgress(0);
  } finally {
    refs.analyzeBtn.disabled = false;
  }
}

async function analyzeViaBackend(url, file, sceneSensitivity) {
  if (!url) {
    throw new Error("Backend URL is required.");
  }

  const form = new FormData();
  form.append("video", file);
  form.append("scene_sensitivity", String(sceneSensitivity));
  form.append("shot_threshold", "0.35");
  form.append("include_object_detection", "true");
  form.append("include_shot_scale", "true");

  setProgress(12);
  const res = await fetch(url, { method: "POST", body: form });
  setProgress(78);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {
      // ignore json parse errors
    }
    throw new Error(detail);
  }
  const data = await res.json();
  setProgress(92);
  return data;
}

function normalizeApiResult(data, interval, sensitivity) {
  if (!data || !data.meta || !data.global || !Array.isArray(data.scenes)) {
    throw new Error("Invalid backend response shape.");
  }
  return {
    meta: data.meta,
    global: data.global,
    scenes: data.scenes,
    shots: Array.isArray(data.shots) ? data.shots : [],
    outputs: data.outputs || {},
    config: { interval, sensitivity, source: "backend" },
  };
}

function setFeatureButtonsEnabled(enabled) {
  refs.openShotDataBtn.disabled = !enabled;
  refs.openColorBtn.disabled = !enabled;
  refs.openObjectsBtn.disabled = !enabled;
  refs.exportJsonBtn.disabled = !enabled;
  refs.exportScenesCsvBtn.disabled = !enabled;
  refs.exportShotsCsvBtn.disabled = !enabled;
  refs.generateLlmDraftBtn.disabled = !enabled;
}

async function analyzeVideo(video, intervalSec, sensitivity, onProgress) {
  const duration = Number(video.duration || 0);
  if (!duration || Number.isNaN(duration)) {
    throw new Error("Invalid video duration.");
  }

  const samples = await sampleFrames(video, intervalSec, onProgress);
  onProgress(74, "Detecting shot boundaries...");
  const shots = detectShots(samples, duration, sensitivity);

  onProgress(84, "Grouping scenes...");
  const scenes = detectScenes(shots, duration, sensitivity);

  onProgress(92, "Computing scene summaries...");
  const sceneSummaries = summarizeScenes(scenes, shots);

  const asl = shots.length ? avg(shots.map((s) => s.durationSec)) : 0;
  const avgSceneLen = sceneSummaries.length ? avg(sceneSummaries.map((s) => s.durationSec)) : 0;

  onProgress(100, "Finalizing UI models...");

  return {
    samples,
    shots,
    scenes: sceneSummaries,
    global: {
      shotCount: shots.length,
      sceneCount: sceneSummaries.length,
      averageShotLengthSec: asl,
      averageSceneLengthSec: avgSceneLen,
      averageShotsPerScene: sceneSummaries.length ? shots.length / sceneSummaries.length : 0,
    },
  };
}

async function sampleFrames(video, intervalSec, onProgress) {
  const canvas = refs.analysisCanvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const duration = Number(video.duration || 0);
  const times = [];
  for (let t = 0; t < duration; t += intervalSec) {
    times.push(Number(t.toFixed(3)));
  }
  if (!times.length || times[times.length - 1] < duration - 0.25) {
    times.push(Math.max(0, Number((duration - 0.02).toFixed(3))));
  }

  const out = [];

  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const features = extractFrameFeatures(data, width, height);
    out.push({ timeSec: t, ...features });

    const pct = Math.round(((i + 1) / times.length) * 72);
    onProgress(pct, `Sampling frames ${i + 1}/${times.length}`);
  }

  return out;
}

function extractFrameFeatures(data, width, height) {
  const totalPixels = width * height;
  const gray = new Float32Array(totalPixels);
  const hist = new Array(16).fill(0);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let satSum = 0;
  let brightness = 0;

  for (let px = 0, i = 0; i < data.length; i += 4, px += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    sumR += r;
    sumG += g;
    sumB += b;

    const maxCh = Math.max(r, g, b);
    const minCh = Math.min(r, g, b);
    const sat = maxCh === 0 ? 0 : (maxCh - minCh) / maxCh;
    satSum += sat;

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[px] = luma;
    brightness += luma;

    const bin = Math.min(15, Math.floor(luma / 16));
    hist[bin] += 1;
  }

  for (let i = 0; i < hist.length; i += 1) {
    hist[i] /= totalPixels;
  }

  let globalEnergy = 0;
  let centerEnergy = 0;
  const cx0 = Math.floor(width * 0.3);
  const cx1 = Math.floor(width * 0.7);
  const cy0 = Math.floor(height * 0.3);
  const cy1 = Math.floor(height * 0.7);

  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const idx = y * width + x;
      const gx = gray[idx] - gray[idx - 1];
      const gy = gray[idx] - gray[idx - width];
      const grad = Math.abs(gx) + Math.abs(gy);
      globalEnergy += grad;

      if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) {
        centerEnergy += grad;
      }
    }
  }

  return {
    avgRgb: [sumR / totalPixels, sumG / totalPixels, sumB / totalPixels],
    hist,
    saturation: satSum / totalPixels,
    brightness: brightness / totalPixels,
    texture: globalEnergy / totalPixels,
    centerFocusRatio: centerEnergy / (globalEnergy + 1e-6),
  };
}

function detectShots(samples, durationSec, sensitivity) {
  if (!samples.length) return [];

  const transitions = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const cur = samples[i];

    const colorDiff = rgbDistance(prev.avgRgb, cur.avgRgb);
    const histDiff = l1Dist(prev.hist, cur.hist) * 100;
    const textureDiff = Math.abs(prev.texture - cur.texture) * 18;

    const score = colorDiff * 0.72 + histDiff * 0.22 + textureDiff * 0.06;
    transitions.push({ index: i, timeSec: cur.timeSec, score });
  }

  const scores = transitions.map((t) => t.score);
  const mean = avg(scores);
  const sd = std(scores);
  const sensitivityFactor = 1.35 - sensitivity * 0.08; // sensitivity 10 => lower threshold
  const threshold = mean + sd * Math.max(0.45, sensitivityFactor);

  const boundaries = [0];
  transitions.forEach((t) => {
    if (t.score >= threshold) boundaries.push(t.timeSec);
  });

  const deduped = [...new Set(boundaries.map((x) => Number(x.toFixed(3))))].sort((a, b) => a - b);
  if (deduped[deduped.length - 1] < durationSec) {
    deduped.push(durationSec);
  }

  const shots = [];
  for (let i = 0; i < deduped.length - 1; i += 1) {
    const start = deduped[i];
    const end = deduped[i + 1];
    if (end - start < 0.15) continue;

    const shotSamples = samples.filter((s) => s.timeSec >= start && s.timeSec < end + 1e-6);
    const meanRgb = averageRgb(shotSamples.map((s) => s.avgRgb));
    const meanFocus = avg(shotSamples.map((s) => s.centerFocusRatio));
    const meanTexture = avg(shotSamples.map((s) => s.texture));

    shots.push({
      shotId: shots.length + 1,
      startSec: start,
      endSec: end,
      durationSec: end - start,
      avgRgb: meanRgb,
      focus: meanFocus,
      texture: meanTexture,
      shotScale: classifyShotScale(meanFocus),
    });
  }

  return shots;
}

function classifyShotScale(centerFocusRatio) {
  if (centerFocusRatio >= 0.62) return "Close-Up";
  if (centerFocusRatio >= 0.49) return "Medium";
  return "Long";
}

function detectScenes(shots, durationSec, sensitivity) {
  if (!shots.length) {
    return [{ sceneId: 1, shotIds: [], startSec: 0, endSec: durationSec }];
  }

  const boundaries = [0];
  const baseThreshold = 45 - sensitivity * 1.6;

  for (let i = 1; i < shots.length; i += 1) {
    const prev = shots[i - 1];
    const cur = shots[i];
    const drift = rgbDistance(prev.avgRgb, cur.avgRgb);
    const rhythm = Math.abs(prev.durationSec - cur.durationSec) * 7;
    const cue = drift + rhythm;

    const shotsSinceBoundary = i - boundaries[boundaries.length - 1];
    if ((cue > baseThreshold && shotsSinceBoundary >= 2) || shotsSinceBoundary >= 8) {
      boundaries.push(i);
    }
  }

  boundaries.push(shots.length);

  const scenes = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const s = boundaries[i];
    const e = boundaries[i + 1];
    const sceneShots = shots.slice(s, e);
    if (!sceneShots.length) continue;

    scenes.push({
      sceneId: scenes.length + 1,
      shotIds: sceneShots.map((x) => x.shotId),
      startSec: sceneShots[0].startSec,
      endSec: sceneShots[sceneShots.length - 1].endSec,
    });
  }

  return scenes;
}

function summarizeScenes(scenes, shots) {
  return scenes.map((scene) => {
    const sceneShots = shots.filter((shot) => scene.shotIds.includes(shot.shotId));
    const durationSec = scene.endSec - scene.startSec;
    const avgShotLenSec = sceneShots.length ? durationSec / sceneShots.length : 0;

    const counts = { Long: 0, Medium: 0, "Close-Up": 0 };
    sceneShots.forEach((s) => {
      counts[s.shotScale] = (counts[s.shotScale] || 0) + 1;
    });

    const dominantRgb = averageRgb(sceneShots.map((s) => s.avgRgb));
    const hue = rgbToHue(dominantRgb);
    const motionProxy = avg(sceneShots.map((s) => s.texture));

    const props = inferNotableProps(dominantRgb, motionProxy, avg(sceneShots.map((s) => s.focus)));

    return {
      sceneId: scene.sceneId,
      startSec: scene.startSec,
      endSec: scene.endSec,
      durationSec,
      shotCount: sceneShots.length,
      averageShotLengthSec: avgShotLenSec,
      shotScaleComposition: {
        longPct: pct(counts.Long, sceneShots.length),
        mediumPct: pct(counts.Medium, sceneShots.length),
        closePct: pct(counts["Close-Up"], sceneShots.length),
      },
      dominantRgb,
      dominantHue: hue,
      props,
      shots: sceneShots,
      motionProxy,
    };
  });
}

function getFlatShots(analysis) {
  const rows = [];
  analysis.scenes.forEach((scene) => {
    scene.shots.forEach((shot) => {
      rows.push({
        sceneId: scene.sceneId,
        shotId: shot.shotId,
        startSec: shot.startSec,
        endSec: shot.endSec,
        durationSec: shot.durationSec,
        shotScale: shot.shotScale,
        avgRgb: shot.avgRgb,
      });
    });
  });
  return rows;
}

function inferNotableProps(rgb, motionProxy, focusProxy) {
  const [r, g, b] = rgb;
  const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const picks = [];

  if (r > g + 15 && r > b + 15) {
    picks.push({ label: "interior furniture", score: 0.76 });
    picks.push({ label: "wooden surfaces", score: 0.68 });
  }
  if (g > r + 12 && g > b + 12) {
    picks.push({ label: "foliage / plants", score: 0.78 });
    picks.push({ label: "textile details", score: 0.61 });
  }
  if (b > r + 10 && b > g + 10) {
    picks.push({ label: "screens / sky / water", score: 0.74 });
    picks.push({ label: "metal props", score: 0.57 });
  }

  if (brightness < 72) {
    picks.push({ label: "lamps / practical lights", score: 0.64 });
  }

  if (motionProxy > 55) {
    picks.push({ label: "vehicles / moving crowd", score: 0.63 });
  }

  if (focusProxy >= 0.62) {
    picks.push({ label: "hand props / facial accessories", score: 0.58 });
  }

  if (picks.length === 0) {
    picks.push({ label: "set decoration", score: 0.55 });
    picks.push({ label: "background signage", score: 0.49 });
  }

  const dedup = [];
  const seen = new Set();
  picks.forEach((p) => {
    if (!seen.has(p.label)) {
      dedup.push(p);
      seen.add(p.label);
    }
  });

  return dedup
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((p) => ({ ...p, score: Number(p.score.toFixed(2)) }));
}

function renderAll(meta, analysis) {
  renderOverview(meta, analysis);
  renderShotData(analysis);
  renderColorAnalysis(analysis);
  renderObjectAnalysis(analysis);
}

function clearAnalysisViews() {
  Object.values(refs.contents).forEach((el) => {
    el.classList.add("hidden");
    el.innerHTML = "";
  });
  Object.values(refs.placeholders).forEach((el) => {
    el.classList.remove("hidden");
  });
}

function renderOverviewMetadataOnly(meta) {
  const html = `
    <div class="meta-grid">
      ${metaItem("Filename", meta.filename)}
      ${metaItem("Duration", formatTime(meta.durationSec))}
      ${metaItem("Resolution", `${meta.width} × ${meta.height}`)}
      ${metaItem("FPS (estimated)", `${meta.fpsEstimated}`)}
      ${metaItem("Frame count (estimated)", `${meta.frameCountEstimated}`)}
    </div>
  `;

  refs.placeholders.overview.classList.add("hidden");
  refs.contents.overview.classList.remove("hidden");
  refs.contents.overview.innerHTML = html;
}

function renderOverview(meta, analysis) {
  const sceneBlocks = analysis.scenes
    .map((scene) => {
      const pctWidth = Math.max(1.5, (scene.durationSec / meta.durationSec) * 100);
      const color = rgbToCss(scene.dominantRgb);
      return `<div class="scene-block" title="Scene ${scene.sceneId}: ${formatTime(scene.durationSec)}" style="width:${pctWidth}%;background:${color}"></div>`;
    })
    .join("");

  const html = `
    <div class="meta-grid">
      ${metaItem("Filename", meta.filename)}
      ${metaItem("Duration", formatTime(meta.durationSec))}
      ${metaItem("Resolution", `${meta.width} × ${meta.height}`)}
      ${metaItem("FPS (estimated)", `${meta.fpsEstimated}`)}
      ${metaItem("Frame count (estimated)", `${meta.frameCountEstimated}`)}
      ${metaItem("Sampling", `${analysis.config.interval.toFixed(2)}s interval`)}
    </div>

    <div class="kpi-grid">
      ${kpi("Average Shot Length", formatTime(analysis.global.averageShotLengthSec))}
      ${kpi("Average Scene Length", formatTime(analysis.global.averageSceneLengthSec))}
      ${kpi("Total Shots", `${analysis.global.shotCount}`)}
      ${kpi("Total Scenes", `${analysis.global.sceneCount}`)}
      ${kpi("Avg Shots / Scene", `${analysis.global.averageShotsPerScene.toFixed(2)}`)}
    </div>

    <div class="scene-timeline">${sceneBlocks}</div>
    <p class="scene-caption">Scene timeline (segment width = scene duration, color = scene dominant hue)</p>
  `;

  refs.placeholders.overview.classList.add("hidden");
  refs.contents.overview.classList.remove("hidden");
  refs.contents.overview.innerHTML = html;
}

function renderShotData(analysis) {
  const rows = analysis.scenes
    .map((scene) => {
      const scales = scene.shotScaleComposition;
      return `
      <tr>
        <td>Scene ${scene.sceneId}</td>
        <td>${formatTime(scene.startSec)} - ${formatTime(scene.endSec)}</td>
        <td>${formatTime(scene.durationSec)}</td>
        <td>${scene.shotCount}</td>
        <td>${formatTime(scene.averageShotLengthSec)}</td>
        <td>
          <div class="scale-stack" aria-label="shot scale composition">
            <span class="scale-long" style="width:${scales.longPct}%"></span>
            <span class="scale-medium" style="width:${scales.mediumPct}%"></span>
            <span class="scale-close" style="width:${scales.closePct}%"></span>
          </div>
        </td>
        <td>L ${scales.longPct}% / M ${scales.mediumPct}% / C ${scales.closePct}%</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div class="kpi-grid">
      ${kpi("Global ASL", formatTime(analysis.global.averageShotLengthSec))}
      ${kpi("Average Scene Length", formatTime(analysis.global.averageSceneLengthSec))}
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Scene</th>
            <th>Timecode</th>
            <th>Scene Length</th>
            <th>Shot Count</th>
            <th>Avg Shot Length (Scene)</th>
            <th>Shot Scale Mix</th>
            <th>Composition</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  refs.placeholders.shotdata.classList.add("hidden");
  refs.contents.shotdata.classList.remove("hidden");
  refs.contents.shotdata.innerHTML = html;
}

function renderColorAnalysis(analysis) {
  refs.placeholders.color.classList.add("hidden");
  refs.contents.color.classList.remove("hidden");

  const cards = analysis.scenes
    .map((scene) => {
      const id = `wheel-${scene.sceneId}`;
      return `
      <article class="scene-card">
        <h4>Scene ${scene.sceneId}</h4>
        <p class="meta">${formatTime(scene.startSec)} - ${formatTime(scene.endSec)} · Dominant hue ${Math.round(scene.dominantHue)}°</p>
        <div class="wheel-row">
          <canvas id="${id}" class="wheel-canvas" width="180" height="180"></canvas>
          <div>
            <div class="swatch" style="background:${rgbToCss(scene.dominantRgb)}"></div>
            <p class="meta">${rgbLabel(scene.dominantRgb)}</p>
          </div>
        </div>
      </article>
      `;
    })
    .join("");

  refs.contents.color.innerHTML = `<div class="scene-grid">${cards}</div>`;

  analysis.scenes.forEach((scene) => {
    const canvas = document.getElementById(`wheel-${scene.sceneId}`);
    drawColorWheel(canvas, scene.dominantHue, scene.dominantRgb);
  });
}

function drawColorWheel(canvas, hueHighlight, rgbHighlight) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.46;

  ctx.clearRect(0, 0, width, height);

  for (let deg = 0; deg < 360; deg += 1) {
    const start = ((deg - 90) * Math.PI) / 180;
    const end = ((deg + 1 - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsl(${deg}, 88%, 52%)`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const hlStart = ((hueHighlight - 10 - 90) * Math.PI) / 180;
  const hlEnd = ((hueHighlight + 10 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, hlStart, hlEnd);
  ctx.arc(cx, cy, radius * 0.58, hlEnd, hlStart, true);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = rgbToCss(rgbHighlight);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function renderObjectAnalysis(analysis) {
  const cards = analysis.scenes
    .map((scene) => {
      const chips = scene.props
        .map((p) => `<span class="chip">${p.label} · ${Math.round(p.score * 100)}%</span>`)
        .join("");

      return `
      <article class="scene-card">
        <h4>Scene ${scene.sceneId}</h4>
        <p class="meta">${formatTime(scene.startSec)} - ${formatTime(scene.endSec)} · ${scene.shotCount} shots</p>
        <div class="chips">${chips}</div>
      </article>
      `;
    })
    .join("");

  const html = `
    <div class="scene-grid">${cards}</div>
    <p class="note">
      Props are currently heuristic proxies from visual signatures.
      Future step: replace this module with detector output + LLM interpretation API for scene meaning analysis.
    </p>
  `;

  refs.placeholders.objects.classList.add("hidden");
  refs.contents.objects.classList.remove("hidden");
  refs.contents.objects.innerHTML = html;
  refs.llmDraftWrap.classList.remove("hidden");
  refs.llmDraftText.value = "";
}

function generateLlmDraft() {
  if (!state.analysis || !state.meta) return;
  const lines = [];
  lines.push(`Film Clip: ${state.meta.filename}`);
  lines.push(`Duration: ${formatTime(state.meta.durationSec)} | Scenes: ${state.analysis.global.sceneCount} | Shots: ${state.analysis.global.shotCount}`);
  lines.push(`Global ASL: ${formatTime(state.analysis.global.averageShotLengthSec)} | Avg Scene Length: ${formatTime(state.analysis.global.averageSceneLengthSec)}`);
  lines.push("");
  lines.push("Scene Notes (for LLM interpretation):");
  lines.push("");

  state.analysis.scenes.forEach((scene) => {
    const s = scene.shotScaleComposition;
    const propText = scene.props.map((p) => `${p.label} (${Math.round(p.score * 100)}%)`).join(", ");
    lines.push(
      `Scene ${scene.sceneId} [${formatTime(scene.startSec)} - ${formatTime(scene.endSec)}]: duration ${formatTime(scene.durationSec)}, ${scene.shotCount} shots, ASL ${formatTime(scene.averageShotLengthSec)}.`
    );
    lines.push(
      `Shot scales: Long ${s.longPct}%, Medium ${s.mediumPct}%, Close-Up ${s.closePct}%. Dominant hue ${Math.round(scene.dominantHue)}° (${rgbLabel(scene.dominantRgb)}).`
    );
    lines.push(`Notable props: ${propText}.`);
    lines.push("");
  });

  lines.push("Task suggestion:");
  lines.push("Interpret how scene rhythm, dominant color shifts, shot scale composition, and notable props might contribute to narrative meaning and emotional tone.");

  refs.llmDraftText.value = lines.join("\\n");
  setActiveView("objects");
}

function metaItem(name, value) {
  return `<div class="meta-item"><span class="name">${name}</span><span class="value">${value}</span></div>`;
}

function kpi(label, value) {
  return `<article class="kpi-card"><p class="kpi-label">${label}</p><p class="kpi-value">${value}</p></article>`;
}

function setStatus(text) {
  refs.statusText.textContent = text;
}

function setProgress(percent) {
  refs.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function seekTo(video, timeSec) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Failed to seek video frame."));
    };

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });

    try {
      video.currentTime = Math.max(0, Math.min(timeSec, Math.max(0, video.duration - 0.02)));
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

function rgbDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function l1Dist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function std(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = avg(arr);
  const variance = avg(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

function averageRgb(list) {
  if (!list.length) return [0, 0, 0];
  const total = list.reduce(
    (acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]],
    [0, 0, 0],
  );
  return [total[0] / list.length, total[1] / list.length, total[2] / list.length];
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function rgbToHue(rgb) {
  let [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (diff === 0) return 0;

  let hue;
  switch (max) {
    case r:
      hue = ((g - b) / diff) % 6;
      break;
    case g:
      hue = (b - r) / diff + 2;
      break;
    default:
      hue = (r - g) / diff + 4;
      break;
  }

  const deg = hue * 60;
  return deg < 0 ? deg + 360 : deg;
}

function rgbToCss(rgb) {
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbLabel(rgb) {
  const [r, g, b] = rgb.map((v) => Math.round(v));
  return `RGB(${r}, ${g}, ${b})`;
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "00:00";
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[\",\\n]/.test(text)) return `"${text.replace(/\"/g, "\"\"")}"`;
  return text;
}

function toCsv(rows, header) {
  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push(row.map((v) => csvEscape(v)).join(","));
  });
  return `${lines.join("\\n")}\\n`;
}

function exportAnalysisJson() {
  if (!state.analysis || !state.meta) return;
  const payload = {
    videoMeta: state.meta,
    config: state.analysis.config,
    global: state.analysis.global,
    scenes: state.analysis.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      startSec: scene.startSec,
      endSec: scene.endSec,
      durationSec: scene.durationSec,
      shotCount: scene.shotCount,
      averageShotLengthSec: scene.averageShotLengthSec,
      shotScaleComposition: scene.shotScaleComposition,
      dominantRgb: scene.dominantRgb.map((v) => Math.round(v)),
      dominantHue: scene.dominantHue,
      props: scene.props,
    })),
    shots: getFlatShots(state.analysis).map((shot) => ({
      sceneId: shot.sceneId,
      shotId: shot.shotId,
      startSec: shot.startSec,
      endSec: shot.endSec,
      durationSec: shot.durationSec,
      shotScale: shot.shotScale,
      avgRgb: shot.avgRgb.map((v) => Math.round(v)),
    })),
  };
  downloadTextFile(
    `${safeStem(state.meta.filename)}_analysis.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8",
  );
}

function exportScenesCsv() {
  if (!state.analysis || !state.meta) return;
  const header = [
    "scene_id",
    "start_sec",
    "end_sec",
    "duration_sec",
    "shot_count",
    "avg_shot_length_sec",
    "long_pct",
    "medium_pct",
    "close_pct",
    "dominant_hue_deg",
    "dominant_rgb",
    "notable_props",
  ];
  const rows = state.analysis.scenes.map((scene) => [
    scene.sceneId,
    scene.startSec.toFixed(3),
    scene.endSec.toFixed(3),
    scene.durationSec.toFixed(3),
    scene.shotCount,
    scene.averageShotLengthSec.toFixed(3),
    scene.shotScaleComposition.longPct,
    scene.shotScaleComposition.mediumPct,
    scene.shotScaleComposition.closePct,
    Math.round(scene.dominantHue),
    rgbLabel(scene.dominantRgb),
    scene.props.map((p) => p.label).join(" | "),
  ]);
  downloadTextFile(
    `${safeStem(state.meta.filename)}_scenes.csv`,
    toCsv(rows, header),
    "text/csv;charset=utf-8",
  );
}

function exportShotsCsv() {
  if (!state.analysis || !state.meta) return;
  const header = ["scene_id", "shot_id", "start_sec", "end_sec", "duration_sec", "shot_scale", "avg_rgb"];
  const rows = getFlatShots(state.analysis).map((shot) => [
    shot.sceneId,
    shot.shotId,
    shot.startSec.toFixed(3),
    shot.endSec.toFixed(3),
    shot.durationSec.toFixed(3),
    shot.shotScale,
    rgbLabel(shot.avgRgb),
  ]);
  downloadTextFile(
    `${safeStem(state.meta.filename)}_shots.csv`,
    toCsv(rows, header),
    "text/csv;charset=utf-8",
  );
}

function safeStem(filename) {
  const i = filename.lastIndexOf(".");
  const stem = i > 0 ? filename.slice(0, i) : filename;
  return stem.replace(/[^a-zA-Z0-9-_]+/g, "_");
}
