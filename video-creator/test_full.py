"""
Full multi-take Veo test — 3 fast base takes, extension, and standard ceiling clip.
Run with: python3 video-creator/test_full.py [step] [choice]
  step 1: Generate 3 fast base takes (default)
  step 2 <choice>: Extend chosen take (e.g., "step2 2" to extend take 2)
  step 3: Generate standard quality ceiling clip
"""
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not found in .env")
    sys.exit(1)

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)
OUTPUT = os.path.join(os.path.dirname(__file__), "output")

N_TAKES = 3

BASE_PROMPT = """Hyper-realistic close-up video of a real white-and-tabby cat with normal cat proportions, wearing a tiny brown leather cowboy hat. The cat is standing at a bathroom sink, holding a toothbrush in one paw and squeezing toothpaste onto it with the other paw, just like a human would. Realistic bathroom setting with towels, toiletries, warm beige tiles. The cat has big expressive green eyes and looks directly at the camera with a calm, slightly sleepy morning expression. Close-up framing, shallow depth of field, warm indoor lighting. The cat moves naturally — real cat body language, not cartoon or anthropomorphic. It speaks in a cute gentle voice: "Good morning, guys. I really didn't want to get out of bed today." Style: photorealistic, shot on a high-end phone camera, cozy morning routine vlog. No animation, no CGI look, no uncanny valley."""

EXTENSION_PROMPT = """Continue the same shot seamlessly. The orange tabby cat stretches, rubs one eye with a paw, sighs, and slowly stands up from the bed, then steps toward the window as the morning light brightens. Same handheld selfie framing, same apartment, same realistic fur and lighting. Natural movement with light ambient sound; keep the cozy, calm vlog mood. No cuts and no scene change — one continuous moment."""


def _wait(operation):
    while not operation.done:
        print("  ...generating")
        time.sleep(10)
        operation = client.operations.get(operation)
    return operation


def generate_base(model, filename):
    filepath = os.path.join(OUTPUT, filename)
    cfg = types.GenerateVideosConfig(aspect_ratio="16:9", resolution="720p")
    op = _wait(client.models.generate_videos(model=model, prompt=BASE_PROMPT, config=cfg))
    gv = op.response.generated_videos[0]
    client.files.download(file=gv.video)
    gv.video.save(filepath)
    size_mb = os.path.getsize(filepath) / 1024 / 1024
    print(f"  saved {filepath} ({size_mb:.1f} MB)")
    return gv


def extend(model, filename, source_video):
    filepath = os.path.join(OUTPUT, filename)
    cfg = types.GenerateVideosConfig(number_of_videos=1, resolution="720p")
    op = _wait(client.models.generate_videos(
        model=model, prompt=EXTENSION_PROMPT, video=source_video, config=cfg))
    gv = op.response.generated_videos[0]
    client.files.download(file=gv.video)
    gv.video.save(filepath)
    size_mb = os.path.getsize(filepath) / 1024 / 1024
    print(f"  saved {filepath} ({size_mb:.1f} MB)")
    return gv


step = sys.argv[1] if len(sys.argv) > 1 else "1"

if step == "1":
    print("STEP 1 — Generating 3 fast base takes...")
    for i in range(N_TAKES):
        print(f"\nTake {i + 1}/{N_TAKES}")
        generate_base("veo-3.1-fast-generate-preview", f"fast_base_{i + 1}.mp4")
    print(f"\nDone! Review fast_base_1.mp4 through fast_base_{N_TAKES}.mp4 in video-creator/output/")

elif step == "2":
    choice = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    print(f"\nSTEP 2 — Extending take {choice}...")
    # Re-upload the chosen take
    chosen_file = os.path.join(OUTPUT, f"fast_base_{choice}.mp4")
    uploaded = client.files.upload(file=chosen_file)
    extend("veo-3.1-fast-generate-preview", "fast_extended.mp4", uploaded)
    print("\nDone! Review fast_extended.mp4")

elif step == "3":
    print("\nSTEP 3 — Standard quality ceiling clip...")
    generate_base("veo-3.1-generate-preview", "standard_base.mp4")
    print("\nDone! Compare standard_base.mp4 with the fast takes.")
