# Video Creator — AI Video Generation Testing

## Overview
Subproject for testing AI video generation APIs, with the goal of creating a series of consistent cat character videos doing human activities.

## Setup
```bash
pip install google-genai python-dotenv
```
Add `GEMINI_API_KEY` to the root `.env` file.

## Scripts
- `test_minimal.py` — Single clip test to verify API access
- `test_full.py` — Multi-take generation with scene prompts (run with `python3 test_full.py [step]`)

## Output
All generated videos go to `video-creator/output/` (gitignored).

---

## Character Consistency Solutions

The biggest challenge for a video series is keeping the same character across scenes. Here are the available approaches:

### Option A: Veo 3.1 Image-to-Video (Google Gemini)
Already set up in this project. Supports an `image` parameter to anchor the first frame, plus up to 3 `reference_images`.

```python
from google.genai import types

client.models.generate_videos(
    model="veo-3.1-fast-generate-preview",
    prompt="...",
    image=reference_image,
    config=types.GenerateVideosConfig(
        reference_images=[
            types.VideoGenerationReferenceImage(
                image=ref_img, reference_type="asset"
            )
        ]
    )
)
```

| Tier | 720p | 1080p | 4K |
|------|------|-------|-----|
| Standard | $0.40/sec | $0.40/sec | $0.60/sec |
| Fast | $0.10/sec | $0.12/sec | $0.30/sec |

- **Pros**: Best visual quality, already configured
- **Cons**: $2-4/clip (1080p), reference is "visual influence" not hard identity lock

### Option B: Kling v3 via fal.ai (Best Character Lock)
Explicit `elements` system — the strongest character consistency of any API. Reference characters in prompts as `@Element1`, `@Element2`.

```json
{
    "prompt": "@Element1 sits at a desk typing on a laptop",
    "start_image_url": "https://...",
    "elements": [
        {
            "frontal_image_url": "https://cat-front.jpg",
            "reference_image_urls": [
                "https://cat-side.jpg",
                "https://cat-full.jpg"
            ]
        }
    ],
    "duration": 5,
    "generate_audio": true
}
```

- **Cost**: ~$0.56-0.84/5s clip (4-5x cheaper than Veo)
- **Pros**: Best consistency, multi-character support, cheapest
- **Cons**: Slightly lower quality than Veo, requires fal.ai account

### Option C: MiniMax S2V-01 via fal.ai
Single subject reference image. Simplest API.

```json
{
    "prompt": "...",
    "subject_reference_image_url": "https://character-photo.jpg",
    "prompt_optimizer": true
}
```

- **Cost**: ~$0.50 flat per clip
- **Pros**: Cheapest, strong facial identity retention
- **Cons**: Single character only, 720p max, 6s max duration

### Option D: Luma Ray 3.2 via fal.ai
Keyframe pinning — up to 64 reference images at specific frame positions.

```json
{
    "prompt": "...",
    "image_url": "https://start-frame.jpg",
    "end_image_url": "https://end-frame.jpg",
    "keyframes": ["https://frame-at-30.jpg", "https://frame-at-90.jpg"],
    "keyframe_indexes": [30, 90],
    "resolution": "1080p",
    "duration": "5s"
}
```

- **Cost**: $0.15 (540p) — $1.20 (1080p) per 5s
- **Pros**: Most flexible temporal control, unique keyframe system
- **Cons**: Indirect character locking (via keyframes, not identity)

### Option E: Runway Gen-4 / Gen-4.5
First-frame conditioning via `promptImage`.

- **Cost**: ~$0.48/sec (credit-based, ~$12/mo for 25s)
- **Pros**: High cinematic quality, on par with Veo
- **Cons**: No explicit character lock, credit system is restrictive

### Comparison Table

| Platform | Character Lock | Multi-Character | Cost/5s | Quality |
|----------|---------------|-----------------|---------|---------|
| **Veo 3.1** | Reference images (up to 3) | Limited | $2-4 (1080p) | Best |
| **Kling v3** | `elements[]` identity lock | Yes | $0.56-0.84 | Very good |
| **MiniMax S2V-01** | Subject reference | No | $0.50 flat | Good |
| **Luma Ray 3.2** | Keyframe pinning | Indirect | $0.30-1.20 | Very good |
| **Runway Gen-4** | First-frame anchor | No | ~$2.40 | Very good |
| **Pika v2.2** | None via API | No | $0.20-0.40 | Decent |

### Recommended Approach
1. Generate a canonical reference image of the cat character (using Gemini Imagen)
2. Test both **Veo image-to-video** and **Kling v3 elements** with the same reference
3. Compare quality and consistency, pick the winner for the full series
4. Use the winner to generate all scenes in the series
