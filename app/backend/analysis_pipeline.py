import csv
import os
import re
from collections import Counter
from typing import Any

import cv2
import numpy as np

from app.backend.algorithms.objectDetection import ObjectDetection
from app.backend.algorithms.shotcutTransNetV2 import transNetV2_run
from app.backend.algorithms.shotscale import shotscale


def _safe_stem(name: str) -> str:
    stem, _ = os.path.splitext(name)
    return re.sub(r"[^a-zA-Z0-9-_]+", "_", stem).strip("_") or "video"


def _format_timecode(sec: float) -> str:
    sec = max(0.0, float(sec))
    s = int(round(sec))
    h = s // 3600
    m = (s % 3600) // 60
    r = s % 60
    if h > 0:
        return f"{h:02d}:{m:02d}:{r:02d}"
    return f"{m:02d}:{r:02d}"


def _avg(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = _avg(values)
    return float((sum((v - m) ** 2 for v in values) / len(values)) ** 0.5)


def _rgb_distance(a: list[float], b: list[float]) -> float:
    da = np.array(a, dtype=float) - np.array(b, dtype=float)
    return float(np.sqrt(np.dot(da, da)))


def _rgb_to_hue(rgb: list[float]) -> float:
    r, g, b = [max(0.0, min(255.0, x)) / 255.0 for x in rgb]
    mx = max(r, g, b)
    mn = min(r, g, b)
    d = mx - mn
    if d == 0:
        return 0.0
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    deg = h * 60.0
    return deg if deg >= 0 else deg + 360.0


def _image_avg_rgb(path: str) -> list[float]:
    img = cv2.imread(path)
    if img is None:
        return [0.0, 0.0, 0.0]
    b, g, r, _ = cv2.mean(img)
    return [float(r), float(g), float(b)]


def _frame_id_from_name(filename: str) -> int:
    m = re.search(r"(\d+)", filename)
    if not m:
        return 0
    return int(m.group(1))


def _classify_scale_label(raw_label: str) -> str:
    label = (raw_label or "").lower()
    if "long" in label or "full" in label:
        return "Long"
    if "medium" in label:
        return "Medium"
    if "close" in label:
        return "Close-Up"
    if "empty" in label:
        return "Long"
    return "Unknown"


def _infer_props_fallback(rgb: list[float], motion_proxy: float, focus_proxy: float) -> list[dict[str, Any]]:
    r, g, b = rgb
    picks: list[tuple[str, float]] = []
    brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b

    if r > g + 15 and r > b + 15:
        picks.extend([("interior furniture", 0.76), ("wooden surfaces", 0.68)])
    if g > r + 12 and g > b + 12:
        picks.extend([("foliage / plants", 0.78), ("textile details", 0.61)])
    if b > r + 10 and b > g + 10:
        picks.extend([("screens / sky / water", 0.74), ("metal props", 0.57)])
    if brightness < 72:
        picks.append(("lamps / practical lights", 0.64))
    if motion_proxy > 55:
        picks.append(("vehicles / moving crowd", 0.63))
    if focus_proxy >= 0.62:
        picks.append(("hand props / facial accessories", 0.58))
    if not picks:
        picks.extend([("set decoration", 0.55), ("background signage", 0.49)])

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for label, score in sorted(picks, key=lambda x: x[1], reverse=True):
        if label in seen:
            continue
        seen.add(label)
        out.append({"label": label, "score": round(score, 2), "count": 1})
        if len(out) >= 4:
            break
    return out


def _read_metadata(video_path: str) -> dict[str, Any]:
    cap = cv2.VideoCapture(video_path)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration = frame_count / fps if fps > 0 else float(cap.get(cv2.CAP_PROP_POS_MSEC) or 0) / 1000.0
    cap.release()

    if duration <= 0 and fps > 0 and frame_count > 0:
        duration = frame_count / fps

    return {
        "durationSec": float(duration or 0.0),
        "fps": float(fps or 24.0),
        "frameCount": int(frame_count),
        "width": width,
        "height": height,
    }


def _group_scenes(shots: list[dict[str, Any]], sensitivity: int) -> list[dict[str, Any]]:
    if not shots:
        return []

    boundaries = [0]
    cue_scores = []
    for i in range(1, len(shots)):
        prev = shots[i - 1]
        cur = shots[i]
        drift = _rgb_distance(prev["avgRgb"], cur["avgRgb"])
        rhythm = abs(prev["durationSec"] - cur["durationSec"]) * 7.0
        cue_scores.append(drift + rhythm)

    base = _avg(cue_scores) + _std(cue_scores) * max(0.45, 1.35 - sensitivity * 0.08)

    for i in range(1, len(shots)):
        prev = shots[i - 1]
        cur = shots[i]
        drift = _rgb_distance(prev["avgRgb"], cur["avgRgb"])
        rhythm = abs(prev["durationSec"] - cur["durationSec"]) * 7.0
        cue = drift + rhythm
        shots_since = i - boundaries[-1]
        if (cue >= base and shots_since >= 2) or shots_since >= 8:
            boundaries.append(i)

    boundaries.append(len(shots))

    scenes: list[dict[str, Any]] = []
    for i in range(len(boundaries) - 1):
        s = boundaries[i]
        e = boundaries[i + 1]
        scene_shots = shots[s:e]
        if not scene_shots:
            continue
        scenes.append(
            {
                "sceneId": i + 1,
                "shotStartIndex": s,
                "shotEndIndex": e - 1,
                "startSec": float(scene_shots[0]["startSec"]),
                "endSec": float(scene_shots[-1]["endSec"]),
            }
        )
    return scenes


def analyze_video(
    *,
    video_path: str,
    original_filename: str,
    scene_sensitivity: int = 6,
    shot_threshold: float = 0.35,
    include_object_detection: bool = True,
    include_shot_scale: bool = True,
) -> dict[str, Any]:
    scene_sensitivity = max(1, min(10, int(scene_sensitivity)))
    shot_threshold = max(0.05, min(0.95, float(shot_threshold)))

    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    stem = _safe_stem(original_filename)
    image_save = os.path.join(project_root, "img", stem)
    os.makedirs(image_save, exist_ok=True)

    meta_raw = _read_metadata(video_path)

    shot_len = transNetV2_run(video_path, image_save, shot_threshold)

    frame_dir = os.path.join(image_save, "frame")
    frame_files = sorted(
        [f for f in os.listdir(frame_dir) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    )
    if not frame_files:
        raise RuntimeError("No shot representative frames were generated.")

    fps = float(meta_raw["fps"] or 24.0)

    scale_runner = None
    if include_shot_scale:
        try:
            scale_runner = shotscale(25)
        except Exception:
            scale_runner = None

    shots: list[dict[str, Any]] = []
    for i, item in enumerate(shot_len):
        start_f, end_f, length_f = [int(x) for x in item]
        rep_idx = min(i, len(frame_files) - 1)
        rep_name = frame_files[rep_idx]
        rep_path = os.path.join(frame_dir, rep_name)

        avg_rgb = _image_avg_rgb(rep_path)

        raw_scale = "Unknown"
        normalized_scale = "Unknown"
        if scale_runner is not None:
            try:
                _, raw_scale, _ = scale_runner.predict(rep_path)
                normalized_scale = _classify_scale_label(raw_scale)
            except Exception:
                raw_scale = "Unknown"
                normalized_scale = "Unknown"

        shots.append(
            {
                "shotId": i + 1,
                "startFrame": start_f,
                "endFrame": end_f,
                "lengthFrames": length_f,
                "startSec": start_f / fps,
                "endSec": end_f / fps,
                "durationSec": length_f / fps,
                "frameFile": rep_name,
                "frameId": _frame_id_from_name(rep_name),
                "avgRgb": avg_rgb,
                "shotScale": normalized_scale,
                "shotScaleRaw": raw_scale,
                "focus": 0.0,
                "texture": 0.0,
            }
        )

    if not shots:
        shots.append(
            {
                "shotId": 1,
                "startFrame": 0,
                "endFrame": int(meta_raw["frameCount"]),
                "lengthFrames": int(meta_raw["frameCount"]),
                "startSec": 0.0,
                "endSec": float(meta_raw["durationSec"]),
                "durationSec": float(meta_raw["durationSec"]),
                "frameFile": frame_files[0],
                "frameId": _frame_id_from_name(frame_files[0]),
                "avgRgb": _image_avg_rgb(os.path.join(frame_dir, frame_files[0])),
                "shotScale": "Unknown",
                "shotScaleRaw": "Unknown",
                "focus": 0.0,
                "texture": 0.0,
            }
        )

    scenes_raw = _group_scenes(shots, scene_sensitivity)

    object_by_frame: dict[int, str] = {}
    if include_object_detection:
        try:
            ObjectDetection(image_save).object_detection()
            obj_csv = os.path.join(image_save, "objects.csv")
            if os.path.exists(obj_csv):
                with open(obj_csv, newline="", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        frame_id = int(row.get("FrameId", "0") or 0)
                        label = (row.get("Top1-Objects") or "").strip()
                        if label:
                            object_by_frame[frame_id] = label
        except Exception:
            object_by_frame = {}

    scenes: list[dict[str, Any]] = []
    for scene in scenes_raw:
        scene_shots = shots[scene["shotStartIndex"] : scene["shotEndIndex"] + 1]
        duration = max(0.0, scene["endSec"] - scene["startSec"])
        shot_count = len(scene_shots)
        asl_scene = duration / shot_count if shot_count else 0.0

        scale_counter = Counter([s["shotScale"] for s in scene_shots])
        long_pct = int(round(100 * scale_counter.get("Long", 0) / shot_count)) if shot_count else 0
        medium_pct = int(round(100 * scale_counter.get("Medium", 0) / shot_count)) if shot_count else 0
        close_pct = int(round(100 * scale_counter.get("Close-Up", 0) / shot_count)) if shot_count else 0

        dominant_rgb = [
            _avg([s["avgRgb"][0] for s in scene_shots]),
            _avg([s["avgRgb"][1] for s in scene_shots]),
            _avg([s["avgRgb"][2] for s in scene_shots]),
        ]
        dominant_hue = _rgb_to_hue(dominant_rgb)

        labels = [object_by_frame.get(s["frameId"], "") for s in scene_shots]
        labels = [x for x in labels if x]
        if labels:
            c = Counter(labels)
            props = [
                {
                    "label": label,
                    "score": round(cnt / shot_count, 2) if shot_count else 0.0,
                    "count": cnt,
                }
                for label, cnt in c.most_common(4)
            ]
        else:
            props = _infer_props_fallback(
                dominant_rgb,
                motion_proxy=0.0,
                focus_proxy=0.62 * (close_pct / 100.0) + 0.5 * (medium_pct / 100.0),
            )

        scenes.append(
            {
                "sceneId": scene["sceneId"],
                "startSec": scene["startSec"],
                "endSec": scene["endSec"],
                "startTc": _format_timecode(scene["startSec"]),
                "endTc": _format_timecode(scene["endSec"]),
                "durationSec": duration,
                "shotCount": shot_count,
                "averageShotLengthSec": asl_scene,
                "shotScaleComposition": {
                    "longPct": long_pct,
                    "mediumPct": medium_pct,
                    "closePct": close_pct,
                },
                "dominantRgb": dominant_rgb,
                "dominantHue": dominant_hue,
                "props": props,
                "shots": scene_shots,
                "motionProxy": 0.0,
            }
        )

    global_metrics = {
        "shotCount": len(shots),
        "sceneCount": len(scenes),
        "averageShotLengthSec": _avg([s["durationSec"] for s in shots]),
        "averageSceneLengthSec": _avg([s["durationSec"] for s in scenes]),
        "averageShotsPerScene": (len(shots) / len(scenes)) if scenes else 0.0,
    }

    return {
        "meta": {
            "id": _safe_stem(original_filename),
            "filename": original_filename,
            "durationSec": float(meta_raw["durationSec"]),
            "width": int(meta_raw["width"]),
            "height": int(meta_raw["height"]),
            "frameCountEstimated": int(meta_raw["frameCount"]),
            "fpsEstimated": round(float(meta_raw["fps"]), 3),
        },
        "global": global_metrics,
        "shots": shots,
        "scenes": scenes,
        "outputs": {
            "imageBase": image_save,
            "frameDir": frame_dir,
            "shotlenCsv": os.path.join(image_save, "shotlen.csv"),
            "shotlenPng": os.path.join(image_save, "shotlen.png"),
            "objectsCsv": os.path.join(image_save, "objects.csv"),
        },
    }
