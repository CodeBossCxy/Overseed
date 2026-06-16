"""
Minimal Gemini Veo API test — generates one short video clip.
Cost: ~$0.50-1.00 for a single 720p 8s clip.
"""
import os
import sys
import time
from dotenv import load_dotenv

# Load .env from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not found in .env")
    sys.exit(1)

print(f"API key loaded: {api_key[:8]}...{api_key[-4:]}")

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

# Simple test prompt — short and cheap
PROMPT = "A cute orange tabby cat sitting on a windowsill, looking outside at a sunny morning. Soft natural light, shallow depth of field, cozy atmosphere. Handheld camera feel, realistic style."

print("Generating one 720p fast clip...")
print("This may take 1-3 minutes.\n")

cfg = types.GenerateVideosConfig(aspect_ratio="16:9", resolution="720p")

operation = client.models.generate_videos(
    model="veo-3.1-fast-generate-preview",
    prompt=PROMPT,
    config=cfg,
)

while not operation.done:
    print(f"  ...waiting (polling)")
    time.sleep(10)
    operation = client.operations.get(operation)

if operation.response and operation.response.generated_videos:
    gv = operation.response.generated_videos[0]
    output_path = os.path.join(os.path.dirname(__file__), "output", "test_clip.mp4")
    client.files.download(file=gv.video)
    gv.video.save(output_path)
    print(f"\nSUCCESS! Video saved to: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
else:
    print(f"\nFAILED. Response: {operation.response}")
    if operation.error:
        print(f"Error: {operation.error}")
