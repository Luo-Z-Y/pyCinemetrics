import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.backend.analysis_pipeline import analyze_video

app = FastAPI(
    title="Cinemetrics Backend API",
    version="0.1.0",
    description="Scene-centric analysis API contract for the Cinemetrics UI rewrite.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/contract")
def contract() -> dict:
    return {
        "endpoint": "POST /api/analyze",
        "request": {
            "multipart/form-data": {
                "video": "binary file",
                "scene_sensitivity": "int 1..10",
                "shot_threshold": "float 0.05..0.95",
                "include_object_detection": "bool",
                "include_shot_scale": "bool",
            }
        },
        "response_keys": ["meta", "global", "shots", "scenes", "outputs"],
    }


@app.post("/api/analyze")
async def analyze(
    video: UploadFile = File(...),
    scene_sensitivity: int = Form(6),
    shot_threshold: float = Form(0.35),
    include_object_detection: bool = Form(True),
    include_shot_scale: bool = Form(True),
):
    if not video.filename:
        raise HTTPException(status_code=400, detail="Missing video filename.")

    suffix = Path(video.filename).suffix or ".mp4"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tf:
            temp_path = tf.name
            content = await video.read()
            tf.write(content)

        result = analyze_video(
            video_path=temp_path,
            original_filename=video.filename,
            scene_sensitivity=scene_sensitivity,
            shot_threshold=shot_threshold,
            include_object_detection=include_object_detection,
            include_shot_scale=include_shot_scale,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.backend.main:app", host="127.0.0.1", port=8000, reload=True)
