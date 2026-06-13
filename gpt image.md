
---
title: GPT Image 2 | Runware Docs
url: https://runware.ai/docs/models/openai-gpt-image-2
description: Image generation and editing model with strong prompt fidelity, text rendering, and layout-aware control
---
# GPT Image 2

GPT Image 2 is a general-purpose GPT Image family model for text-to-image generation and image editing. Its strengths include strong prompt adherence, readable embedded text, detailed edits, photorealistic rendering, and structured visual outputs such as posters, packaging, product comps, diagrams, and other layout-sensitive images.

- **ID**: `openai:gpt-image@2`
- **Status**: live
- **Creator**: OpenAI
- **Release Date**: April 21, 2026
- **Capabilities**: Text to Image, Image to Image, Edit, Checkpoint

## Pricing

Pricing is based per 1M Token for image at $8.00 (input), $2.00 (cached input), $30.00 (output). For text at $5.00 (input), $1.25 (cached input), $10.00 (output). Below are estimation examples based on quality which changes significantly the price.

- **1024 x 1024 . low**: `$0.006`
- **1024 x 1024 . high**: `$0.211`
- **1024 x 1024 . medium**: `$0.053`

## Compatibility & Validation

`width` and `height` must be used together.

## Request Parameters

**API Options**

Platform-level options for task execution and delivery.

### [taskType](https://runware.ai/docs/models/openai-gpt-image-2#request-tasktype)

- **Type**: `string`
- **Required**: true
- **Value**: `imageInference`

Identifier for the type of task being performed

### [taskUUID](https://runware.ai/docs/models/openai-gpt-image-2#request-taskuuid)

- **Type**: `string`
- **Required**: true
- **Format**: `UUID v4`

UUID v4 identifier for tracking tasks and matching async responses. Must be unique per task.

### [outputType](https://runware.ai/docs/models/openai-gpt-image-2#request-outputtype)

- **Type**: `string`
- **Default**: `URL`

Image output type.

**Allowed values**: `URL` `base64Data` `dataURI`

### [outputFormat](https://runware.ai/docs/models/openai-gpt-image-2#request-outputformat)

- **Type**: `string`
- **Default**: `JPG`

Specifies the file format of the generated output. The available values depend on the task type and the specific model's capabilities.

- \`JPG\`: Best for photorealistic images with smaller file sizes (no transparency).
- \`PNG\`: Lossless compression, supports high quality and transparency (alpha channel).
- \`WEBP\`: Modern format providing superior compression and transparency support.

> [!NOTE]
> \*\*Transparency\*\*: If you are using features like background removal or LayerDiffuse that require transparency, you must select a format that supports an alpha channel (e.g., \`PNG\`, \`WEBP\`, \`TIFF\`). \`JPG\` does not support transparency.

**Allowed values**: `JPG` `PNG` `WEBP`

### [outputQuality](https://runware.ai/docs/models/openai-gpt-image-2#request-outputquality)

- **Type**: `integer`
- **Min**: `20`
- **Max**: `99`
- **Default**: `95`

Compression quality of the output. Higher values preserve quality but increase file size.

### [webhookURL](https://runware.ai/docs/models/openai-gpt-image-2#request-webhookurl)

- **Type**: `string`
- **Format**: `URI`

Specifies a webhook URL where JSON responses will be sent via HTTP POST when generation tasks complete. For batch requests with multiple results, each completed item triggers a separate webhook call as it becomes available.

**Learn more** (1 resource):

- [Webhooks](https://runware.ai/docs/platform/webhooks) (platform)

### [deliveryMethod](https://runware.ai/docs/models/openai-gpt-image-2#request-deliverymethod)

- **Type**: `string`
- **Default**: `sync`

Determines how the API delivers task results.

**Allowed values**:

- `sync` Returns complete results directly in the API response.
- `async` Returns an immediate acknowledgment with the task UUID. Poll for results using getResponse.

**Learn more** (1 resource):

- [Task Polling](https://runware.ai/docs/platform/task-polling) (platform)

### [uploadEndpoint](https://runware.ai/docs/models/openai-gpt-image-2#request-uploadendpoint)

- **Type**: `string`
- **Format**: `URI`

Specifies a URL where the generated content will be automatically uploaded using the HTTP PUT method. The raw binary data of the media file is sent directly as the request body. For secure uploads to cloud storage, use presigned URLs that include temporary authentication credentials.

**Common use cases:**

- **Cloud storage**: Upload directly to S3 buckets, Google Cloud Storage, or Azure Blob Storage using presigned URLs.
- **CDN integration**: Upload to content delivery networks for immediate distribution.

```text
// S3 presigned URL for secure upload
https://your-bucket.s3.amazonaws.com/generated/content.mp4?X-Amz-Signature=abc123&X-Amz-Expires=3600

// Google Cloud Storage presigned URL
https://storage.googleapis.com/your-bucket/content.jpg?X-Goog-Signature=xyz789

// Custom storage endpoint
https://storage.example.com/uploads/generated-image.jpg
```

The content data will be sent as the request body to the specified URL when generation is complete.

### [safety](https://runware.ai/docs/models/openai-gpt-image-2#request-safety)

- **Path**: `safety.checkContent`
- **Type**: `object (1 property)`

Content safety checking configuration for image generation.

#### [checkContent](https://runware.ai/docs/models/openai-gpt-image-2#request-safety-checkcontent)

- **Path**: `safety.checkContent`
- **Type**: `boolean`
- **Default**: `false`

Enable or disable content safety checking.

### [ttl](https://runware.ai/docs/models/openai-gpt-image-2#request-ttl)

- **Type**: `integer`
- **Min**: `60`

Time-to-live (TTL) in seconds for generated content. Only applies when `outputType` is `URL`.

### [includeCost](https://runware.ai/docs/models/openai-gpt-image-2#request-includecost)

- **Type**: `boolean`
- **Default**: `false`

Include task cost in the response.

### [numberResults](https://runware.ai/docs/models/openai-gpt-image-2#request-numberresults)

- **Type**: `integer`
- **Min**: `1`
- **Max**: `20`
- **Default**: `1`

Number of results to generate. Each result uses a different seed, producing variations of the same parameters.

**Inputs**

Input resources for the task (images, audio, etc). These must be nested inside the \`inputs\` object.

### [referenceImages](https://runware.ai/docs/models/openai-gpt-image-2#request-inputs-referenceimages)

- **Path**: `inputs.referenceImages`
- **Type**: `array of strings`

List of reference images (UUID, URL, Data URI, or Base64).

**Core Parameters**

Primary parameters that define the task output.

### [model](https://runware.ai/docs/models/openai-gpt-image-2#request-model)

- **Type**: `string`
- **Required**: true
- **Value**: `openai:gpt-image@2`

Identifier of the model to use for generation.

### [positivePrompt](https://runware.ai/docs/models/openai-gpt-image-2#request-positiveprompt)

- **Type**: `string`
- **Required**: true
- **Min**: `2`
- **Max**: `32000`

Text prompt describing elements to include in the generated output.

### [width](https://runware.ai/docs/models/openai-gpt-image-2#request-width)

- **Type**: `integer`
- **Required**: true
- **Min**: `480`
- **Max**: `3840`
- **Step**: `16`

Width of the generated media in pixels.

### [height](https://runware.ai/docs/models/openai-gpt-image-2#request-height)

- **Type**: `integer`
- **Required**: true
- **Min**: `480`
- **Max**: `3840`
- **Step**: `16`

Height of the generated media in pixels.

**Provider Settings**

Parameters specific to this model provider. These must be nested inside the \`providerSettings.openai\` object.

### [moderation](https://runware.ai/docs/models/openai-gpt-image-2#request-providersettings-openai-moderation)

- **Path**: `providerSettings.openai.moderation`
- **Type**: `string`
- **Default**: `auto`

Content moderation level.

**Allowed values**:

- `auto` Standard filtering that limits creating certain categories of potentially age-inappropriate content.
- `low` Less restrictive filtering.

### [quality](https://runware.ai/docs/models/openai-gpt-image-2#request-providersettings-openai-quality)

- **Path**: `providerSettings.openai.quality`
- **Type**: `string`
- **Default**: `auto`

Image quality level.

**Allowed values**:

- `auto` Automatically selects optimal quality based on context.
- `high` Maximum quality with enhanced detail and refinement.
- `medium` Balanced quality suitable for most use cases.
- `low` Faster generation with acceptable quality for rapid iteration.

## Response Parameters

### [taskType](https://runware.ai/docs/models/openai-gpt-image-2#response-tasktype)

- **Type**: `string`
- **Required**: true
- **Value**: `imageInference`

Type of the task.

### [taskUUID](https://runware.ai/docs/models/openai-gpt-image-2#response-taskuuid)

- **Type**: `string`
- **Required**: true
- **Format**: `UUID v4`

UUID of the task.

### [imageUUID](https://runware.ai/docs/models/openai-gpt-image-2#response-imageuuid)

- **Type**: `string`
- **Required**: true
- **Format**: `UUID v4`

UUID of the output image.

### [imageURL](https://runware.ai/docs/models/openai-gpt-image-2#response-imageurl)

- **Type**: `string`
- **Format**: `URI`

URL of the output image.

### [imageBase64Data](https://runware.ai/docs/models/openai-gpt-image-2#response-imagebase64data)

- **Type**: `string`

Base64-encoded image data.

### [imageDataURI](https://runware.ai/docs/models/openai-gpt-image-2#response-imagedatauri)

- **Type**: `string`
- **Format**: `URI`

Data URI of the output image.

### [seed](https://runware.ai/docs/models/openai-gpt-image-2#response-seed)

- **Type**: `integer`

The seed used for generation. If none was provided, shows the randomly generated seed.

### [NSFWContent](https://runware.ai/docs/models/openai-gpt-image-2#response-nsfwcontent)

- **Type**: `boolean`

Flag indicating if NSFW content was detected.

### [cost](https://runware.ai/docs/models/openai-gpt-image-2#response-cost)

- **Type**: `float`

Task cost in USD. Present when `includeCost` is set to `true` in the request.

## Examples

### Subterranean Citrus Metro Concourse (Text to Image)

![Subterranean Citrus Metro Concourse]()

**Request**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "c295bd45-d5d4-4cdb-95c0-3ed7def5cdd9",
  "model": "openai:gpt-image@2",
  "positivePrompt": "A richly detailed underground metro concourse transformed into a citrus-themed transit hub, cinematic wide-angle view, polished terrazzo floors reflecting amber and tangerine tones, vaulted ceiling with ribbed concrete and suspended wayfinding panels, commuters in contemporary fashion moving through the scene, a central kiosk shaped like a sliced orange, tiled murals of lemons and grapefruits, sleek ticket gates, benches with curved enamel finishes, stacked crates of oranges near a service entrance, subtle haze from train brakes, realistic depth and lighting, photorealistic rendering, ultra-sharp textures, readable embedded text on signs that says 'PLATFORM 3', 'CITRUS LINE', and 'EXIT B', balanced layout, no watermark",
  "width": 1536,
  "height": 1024,
  "providerSettings": {
    "openai": {
      "quality": "high",
      "moderation": "auto"
    }
  }
}
```

**Response**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "c295bd45-d5d4-4cdb-95c0-3ed7def5cdd9",
  "imageUUID": "12b8f96a-c8ed-47bd-8389-6d455a06e4ea",
  "imageURL": "https://im.runware.ai/image/os/a09dlim3/ws/4/ii/12b8f96a-c8ed-47bd-8389-6d455a06e4ea.jpg",
  "cost": 0.16538
}
```

---

### Cabinet of Culinary Specimens (Image to Image)

![Cabinet of Culinary Specimens]()

**Request**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "62ce7879-8da3-4cdd-9a31-f18a61e278c6",
  "referenceImages": [
    "https://assets.runware.ai/assets/inputs/10501302-c696-4b56-829f-d7caf6a3d37a.jpg",
    "https://assets.runware.ai/assets/inputs/28d238c0-3e25-4e40-bf94-41318abff219.jpg",
    "https://assets.runware.ai/assets/inputs/c5764021-5e4e-4ee3-b431-66541b885c1a.jpg",
    "https://assets.runware.ai/assets/inputs/e896c420-8684-4819-985e-3adcd51bf50d.jpg",
    "https://assets.runware.ai/assets/inputs/d515bc77-a09a-4fb9-b556-ccd461791cc9.jpg",
    "https://assets.runware.ai/assets/inputs/cc29a13b-910d-422e-ac37-bbe0bd471a8d.jpg"
  ],
  "model": "openai:gpt-image@2",
  "positivePrompt": "Using all 6 reference images as source inspiration, create a refined overhead composition of an eccentric culinary research archive arranged inside a shallow wooden specimen drawer. Include cut fruit studies, ceramic sample bowls, brass measuring instruments, smoky glass containers, annotated index cards, and carefully ordered ingredient fragments. The scene should feel like a hybrid of gastronomy, taxonomy, and design documentation, with strong spatial organization and clear separations between objects. Add several small readable paper labels in neat serif typography, such as 'FIG SECTION', 'ARIL COUNT', 'PEAR SLICE', 'GLAZE SAMPLE', and 'VOLUME TEST'. Emphasize realistic materials, tactile surfaces, subtle dust, precise shadows, premium editorial lighting, and immaculate detail. Rich but restrained palette: garnet, olive, cream, brass, walnut, and ash gray. Photorealistic, elegant, highly controlled composition, no people, no background clutter.",
  "width": 1536,
  "height": 1024,
  "providerSettings": {
    "openai": {
      "quality": "high",
      "moderation": "auto"
    }
  }
}
```

**Response**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "62ce7879-8da3-4cdd-9a31-f18a61e278c6",
  "imageUUID": "52a65daa-0bab-42c9-aa6d-e389e55031a6",
  "imageURL": "https://im.runware.ai/image/os/a01d21/ws/4/ii/52a65daa-0bab-42c9-aa6d-e389e55031a6.jpg",
  "cost": 0.16468
}
```

---

### Maximalist Curiosity Cabinet Collage (Image to Image)

![Maximalist Curiosity Cabinet Collage]()

**Request**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "5eac448a-60b8-4be2-8de6-9a5c0031d527",
  "referenceImages": [
    "https://assets.runware.ai/assets/inputs/5f88168e-166c-4933-b6e3-b48ca142ea9a.jpg",
    "https://assets.runware.ai/assets/inputs/73b3797f-af09-4bb9-bf6c-257fcbb74167.jpg",
    "https://assets.runware.ai/assets/inputs/cf3e9af6-5b8a-4ae9-a155-9d11233f0ca1.jpg"
  ],
  "model": "openai:gpt-image@2",
  "positivePrompt": "Create an intricate frontal view of a maximalist curiosity cabinet assembled from three reference images. Blend the antique drawer cabinet structure with the natural specimens and scientific tabletop objects into a single meticulously organized scene. Some drawers are open, revealing shells, minerals, feathers, seed pods, pinned insects, tiny labeled vials, folded maps, calipers, and handwritten inventory cards. Include crisp readable drawer labels such as 'Specimen 07', 'River Stones', 'Wing Study', and 'Archive B'. Warm museum lighting, tactile wood grain, brass hardware, paper textures, realistic shadows, elegant composition, highly detailed, photorealistic but slightly whimsical, no people.",
  "width": 1024,
  "height": 768,
  "providerSettings": {
    "openai": {
      "quality": "high",
      "moderation": "auto"
    }
  }
}
```

**Response**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "5eac448a-60b8-4be2-8de6-9a5c0031d527",
  "imageUUID": "6542bc2b-4e17-4141-b6af-094b3ad132e6",
  "imageURL": "https://im.runware.ai/image/os/a08dlim3/ws/3/ii/6542bc2b-4e17-4141-b6af-094b3ad132e6.jpg",
  "cost": 0.16359
}
```

---

### Floating Herbarium Reading Nook (Image to Image)

![Floating Herbarium Reading Nook]()

**Request**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "6f8a3211-45bf-4dee-ae55-02dc5233b21d",
  "referenceImages": [
    "https://assets.runware.ai/assets/inputs/37730e56-2ff2-402b-91d0-1f9a37fdf50e.jpg"
  ],
  "model": "openai:gpt-image@2",
  "positivePrompt": "Transform the single reference image into an imaginative suspended herbarium reading nook inside a vast airy atrium. Preserve the general room layout and furniture placement from the reference, but reimagine the scene with curved wooden shelving, hundreds of neatly mounted dried plants in glass frames, labeled specimen drawers, dangling paper tags, brass stair rails, a deep moss-green armchair, a tiny writing desk with open field journals, and thin bridges connecting to neighboring alcoves in the distance. Soft afternoon sunlight pours through the window and catches floating dust motes. Include crisp readable drawer labels such as 'FERNS', 'SEEDS', and 'ALPINE CUTTINGS'. Photorealistic materials, elegant spatial depth, meticulous textures, calm scholarly mood, natural color palette with touches of amber and green, highly coherent composition.",
  "width": 1024,
  "height": 768,
  "providerSettings": {
    "openai": {
      "quality": "high",
      "moderation": "auto"
    }
  }
}
```

**Response**:

```json
{
  "taskType": "imageInference",
  "taskUUID": "6f8a3211-45bf-4dee-ae55-02dc5233b21d",
  "imageUUID": "956da73b-b755-450c-91e8-961e0a1e630d",
  "imageURL": "https://im.runware.ai/image/os/a10dlim3/ws/3/ii/956da73b-b755-450c-91e8-961e0a1e630d.jpg",
  "cost": 0.15143
}
```