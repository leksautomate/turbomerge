cat << EOF > request.json
{
    "contents": [
        {
            "role": "user",
            "parts": [
            ]
        }
    ]
    , "generationConfig": {
        "temperature": 1
        ,"maxOutputTokens": 32768
        ,"responseModalities": ["TEXT", "IMAGE"]
        ,"topP": 0.95
        ,"imageConfig": {
            "aspectRatio": "auto"
            ,"imageSize": "1K"
            ,"imageOutputOptions": {
                "mimeType": "image/png"
            }
            ,"personGeneration": "ALLOW_ALL"
        }
        ,"thinkingConfig": {
            "thinkingLevel": "MINIMAL"
        }
    },
    "safetySettings": [
        {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "threshold": "OFF"
        },
        {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "threshold": "OFF"
        },
        {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "threshold": "OFF"
        },
        {
            "category": "HARM_CATEGORY_HARASSMENT",
            "threshold": "OFF"
        }
    ]
}
EOF

API_KEY="<YOUR_API_KEY>"
API_ENDPOINT="aiplatform.googleapis.com"
MODEL_ID="gemini-3.1-flash-image-preview"
GENERATE_CONTENT_API="streamGenerateContent"

curl \
-X POST \
-H "Content-Type: application/json" \
"https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${API_KEY}" -d '@request.json'




cat << EOF > request.json
{
    "contents": [
        {
            "role": "user",
            "parts": [
            ]
        }
    ]
    , "generationConfig": {
        "temperature": 1
        ,"maxOutputTokens": 32768
        ,"responseModalities": ["TEXT", "IMAGE"]
        ,"topP": 0.95
        ,"imageConfig": {
            "aspectRatio": "1:1"
            ,"imageSize": "1K"
            ,"imageOutputOptions": {
                "mimeType": "image/png"
            }
            ,"personGeneration": "ALLOW_ALL"
        }
    },
    "safetySettings": [
        {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "threshold": "OFF"
        },
        {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "threshold": "OFF"
        },
        {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "threshold": "OFF"
        },
        {
            "category": "HARM_CATEGORY_HARASSMENT",
            "threshold": "OFF"
        }
    ]
}
EOF

API_KEY="<YOUR_API_KEY>"
API_ENDPOINT="aiplatform.googleapis.com"
MODEL_ID="gemini-3-pro-image-preview"
GENERATE_CONTENT_API="streamGenerateContent"

curl \
-X POST \
-H "Content-Type: application/json" \
"https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${API_KEY}" -d '@request.json'


pip install --upgrade google-genai
import base64


def b64decode(b64_encoded_string: str) -> bytes:
  return base64.b64decode(b64_encoded_string.encode('utf-8'))

  import time
import sys
from google import genai
from google.genai import types

client = genai.Client(
    project="project-f3847793-8610-4a16-945",
    location="us-central1",
)

source = types.GenerateVideosSource(
    prompt="""""",
)

config = types.GenerateVideosConfig(
    aspect_ratio="16:9",
    number_of_videos=4,
    duration_seconds=8,
    person_generation="allow_all",
    generate_audio=True,
    resolution="720p",
    seed=0,
)

# Generate the video generation request
operation = client.models.generate_videos(
    model="veo-3.1-lite-generate-001", source=source, config=config
)

# Waiting for the video(s) to be generated
while not operation.done:
    print("Video has not been generated yet. Check again in 10 seconds...")
    time.sleep(10)
    operation = client.operations.get(operation)

response = operation.result
if not response:
    print("Error occurred while generating video.")
    sys.exit(1)

generated_videos = response.generated_videos
if not generated_videos:
    print("No videos were generated.")
    sys.exit(1)

print(f"Generated {len(generated_videos)} video(s).")
for generated_video in generated_videos:
    if generated_video.video:
        generated_video.video.show()