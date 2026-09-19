/* =========================================================
   VIBENEST — VIDEO STUDIO
   ---------------------------------------------------------
   Handles:
   - AI text-to-video generation
   - VibeNest API connection
   - Video formats
   - Prompt handling
   - Generation status
   - Video preview
   - Download
   - Project saving
   - AI edit command
   - Local uploaded media
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIGURATION
     ======================================================= */

  const API_BASE =
    "https://vibenest-api.vaibhavkhotkar2006.workers.dev";

  const GENERATE_ENDPOINT =
    `${API_BASE}/generate`;

  /*
    These are frontend-safe settings.

    IMPORTANT:
    FAL_KEY is NEVER placed here.
    Your Cloudflare Worker handles the secret.
  */

  const DEFAULT_DURATION = 5;
  const MAX_LOCAL_FILE_SIZE = 250 * 1024 * 1024;

  let selectedFormat = "9:16";
  let selectedDuration = DEFAULT_DURATION;

  let currentVideoUrl = "";
  let currentVideoData = null;

  let generationInProgress = false;

  let uploadedMedia = [];

  /* =======================================================
     HELPERS
     ======================================================= */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return document.querySelectorAll(selector);
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
      return;
    }

    console.log("VibeNest:", message);
  }

  function setText(selector, text) {
    const element = $(selector);

    if (element) {
      element.textContent = text;
    }
  }

  function setValue(selector, value) {
    const element = $(selector);

    if (element) {
      element.value = value;
    }
  }

  function getValue(selector) {
    const element = $(selector);

    return element
      ? String(element.value || "")
      : "";
  }

  /* =======================================================
     FORMAT SETTINGS
     ======================================================= */

  const VIDEO_FORMATS = {
    "9:16": {
      label: "Vertical",
      width: 1080,
      height: 1920,
      description: "Reels, Shorts & TikTok"
    },

    "16:9": {
      label: "Landscape",
      width: 1920,
      height: 1080,
      description: "YouTube & widescreen"
    },

    "1:1": {
      label: "Square",
      width: 1080,
      height: 1080,
      description: "Instagram posts"
    },

    "4:5": {
      label: "Portrait",
      width: 1080,
      height: 1350,
      description: "Instagram portrait"
    }
  };

  function selectVideoFormat(format) {
    if (!VIDEO_FORMATS[format]) {
      return;
    }

    selectedFormat = format;

    /*
      Update all possible format buttons.
    */

    $all(
      "[data-format], .format-option, .video-format-option"
    ).forEach(button => {

      const buttonFormat =
        button.dataset.format ||
        button.dataset.value ||
        button.getAttribute("data-format");

      button.classList.toggle(
        "active",
        buttonFormat === format
      );
    });

    updatePreviewAspectRatio();

    updateFormatLabels();

    showToast(
      `${VIDEO_FORMATS[format].label} format selected`
    );
  }

  function updateFormatLabels() {

    const format =
      VIDEO_FORMATS[selectedFormat];

    if (!format) {
      return;
    }

    const labels =
      $all(
        "[data-video-format-label]"
      );

    labels.forEach(element => {
      element.textContent =
        `${selectedFormat} • ${format.description}`;
    });
  }

  function updatePreviewAspectRatio() {

    const preview =
      document.querySelector(
        ".video-preview-canvas, .video-preview, #videoPreview"
      );

    if (!preview) {
      return;
    }

    preview.dataset.aspectRatio =
      selectedFormat;

    /*
      CSS can use this attribute.
    */

    preview.style.setProperty(
      "--video-aspect",
      selectedFormat
    );
  }

  /* =======================================================
     DURATION
     ======================================================= */

  function selectVideoDuration(duration) {

    const value =
      Number(duration);

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return;
    }

    selectedDuration =
      Math.min(value, 15);

    $all(
      "[data-duration]"
    ).forEach(button => {

      button.classList.toggle(
        "active",
        Number(button.dataset.duration) ===
          selectedDuration
      );

    });

    setText(
      "[data-selected-duration]",
      `${selectedDuration}s`
    );
  }

  /* =======================================================
     PROMPT
     ======================================================= */

  function getVideoPrompt() {

    const selectors = [
      "#videoPrompt",
      "#video-prompt",
      "[name='videoPrompt']",
      "[name='prompt']",
      ".video-prompt textarea"
    ];

    for (const selector of selectors) {

      const element =
        document.querySelector(selector);

      if (
        element &&
        element.value.trim()
      ) {
        return element.value.trim();
      }

    }

    return "";
  }

  function setVideoPrompt(prompt) {

    const selectors = [
      "#videoPrompt",
      "#video-prompt",
      "[name='videoPrompt']",
      "[name='prompt']",
      ".video-prompt textarea"
    ];

    for (const selector of selectors) {

      const element =
        document.querySelector(selector);

      if (element) {
        element.value = prompt;
        break;
      }

    }
  }

  /* =======================================================
     PROMPT ENHANCEMENT
     ======================================================= */

  function buildGenerationPrompt(prompt) {

    const cleanPrompt =
      prompt.trim();

    if (!cleanPrompt) {
      return "";
    }

    /*
      We don't replace the user's idea.

      We only add technical information so
      the generation request is more useful.
    */

    const formatInstruction = {
      "9:16":
        "vertical 9:16 composition",

      "16:9":
        "wide 16:9 cinematic composition",

      "1:1":
        "square 1:1 composition",

      "4:5":
        "portrait 4:5 composition"
    }[selectedFormat];

    return `${cleanPrompt}. ${formatInstruction}. Natural realistic motion, coherent camera movement, detailed lighting, consistent subjects, high visual quality.`;
  }

  /* =======================================================
     GENERATION UI
     ======================================================= */

  function setGenerationState(isGenerating) {

    generationInProgress =
      Boolean(isGenerating);

    const buttons =
      $all(
        "#generateVideoButton, .generate-video-button, [data-generate-video]"
      );

    buttons.forEach(button => {

      button.disabled =
        generationInProgress;

      if (generationInProgress) {

        button.dataset.originalText =
          button.textContent;

        button.innerHTML =
          `
            <span class="button-spinner"></span>
            Generating...
          `;

      } else {

        const original =
          button.dataset.originalText;

        if (original) {
          button.textContent =
            original;
        }

      }

    });

    const loading =
      document.querySelector(
        "#videoGenerationLoading, .video-generation-loading"
      );

    if (loading) {
      loading.classList.toggle(
        "active",
        generationInProgress
      );
    }
  }

  function updateGenerationStatus(
    message,
    progress = null
  ) {

    const statusElements =
      $all(
        "#videoGenerationStatus, .video-generation-status, [data-video-status]"
      );

    statusElements.forEach(element => {
      element.textContent =
        message;
    });

    if (
      progress !== null &&
      Number.isFinite(progress)
    ) {

      const bars =
        $all(
          ".video-generation-progress, [data-video-progress]"
        );

      bars.forEach(bar => {

        bar.style.width =
          `${Math.max(
            0,
            Math.min(
              100,
              progress
            )
          )}%`;

      });

    }
  }

  /* =======================================================
     API REQUEST
     ======================================================= */

  async function generateVideo() {

    if (generationInProgress) {
      return;
    }

    const prompt =
      getVideoPrompt();

    if (!prompt) {

      showToast(
        "Enter a video idea first."
      );

      const input =
        document.querySelector(
          "#videoPrompt, #video-prompt, [name='videoPrompt']"
        );

      if (input) {
        input.focus();
      }

      return;
    }

    if (
      prompt.length >
      4000
    ) {

      showToast(
        "Your prompt is too long. Please keep it under 4000 characters."
      );

      return;
    }

    const finalPrompt =
      buildGenerationPrompt(prompt);

    setGenerationState(true);

    updateGenerationStatus(
      "Connecting to VibeNest AI...",
      10
    );

    try {

      const response =
        await fetch(
          GENERATE_ENDPOINT,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              prompt: finalPrompt,

              /*
                These values are sent to the Worker
                for future model routing.
              */

              format:
                selectedFormat,

              duration:
                selectedDuration
            })
          }
        );

      updateGenerationStatus(
        "Processing your video...",
        35
      );

      const rawText =
        await response.text();

      let data = {};

      try {
        data =
          JSON.parse(rawText);
      } catch {
        data = {
          raw: rawText
        };
      }

      if (!response.ok) {

        const errorMessage =
          data.error ||
          data.message ||
          data.detail ||
          `Generation failed (${response.status})`;

        throw new Error(
          errorMessage
        );
      }

      updateGenerationStatus(
        "VibeNest received your generation request.",
        60
      );

      /*
        fal queue endpoints can return a request ID
        instead of an immediately available video.

        First try to find a direct video URL.
      */

      const directUrl =
        extractVideoUrl(data);

      if (directUrl) {

        updateGenerationStatus(
          "Video ready.",
          100
        );

        handleGeneratedVideo(
          directUrl,
          data,
          prompt
        );

        return;
      }

      /*
        If the response contains a request ID,
        poll the Worker if polling is supported.
      */

      const requestId =
        extractRequestId(data);

      if (requestId) {

        updateGenerationStatus(
          "Video is rendering...",
          65
        );

        const result =
          await pollGeneration(
            requestId
          );

        const videoUrl =
          extractVideoUrl(result);

        if (!videoUrl) {

          throw new Error(
            "The video job finished, but no video URL was returned."
          );

        }

        updateGenerationStatus(
          "Video ready.",
          100
        );

        handleGeneratedVideo(
          videoUrl,
          result,
          prompt
        );

        return;
      }

      /*
        Some providers return nested data.
      */

      const nestedUrl =
        findVideoUrlDeep(data);

      if (nestedUrl) {

        updateGenerationStatus(
          "Video ready.",
          100
        );

        handleGeneratedVideo(
          nestedUrl,
          data,
          prompt
        );

        return;
      }

      /*
        We don't pretend the video exists.
      */

      console.warn(
        "VibeNest generation response:",
        data
      );

      throw new Error(
        "The AI service accepted the request, but did not return a video yet."
      );

    } catch (error) {

      console.error(
        "VibeNest video generation error:",
        error
      );

      updateGenerationStatus(
        "Generation failed.",
        0
      );

      showToast(
        error.message ||
        "Could not generate the video."
      );

    } finally {

      setGenerationState(false);

    }
  }

  /* =======================================================
     VIDEO URL EXTRACTION
     ======================================================= */

  function extractVideoUrl(data) {

    if (!data) {
      return null;
    }

    if (
      typeof data === "string" &&
      isVideoUrl(data)
    ) {
      return data;
    }

    const possible =
      [
        data.video_url,
        data.videoUrl,
        data.url,
        data.output_url,
        data.outputUrl,

        data.video,
        data.output,

        data?.data?.video_url,
        data?.data?.videoUrl,
        data?.data?.url,

        data?.video?.url,
        data?.output?.url,

        data?.data?.video?.url,
        data?.data?.output?.url
      ];

    for (
      const value of possible
    ) {

      if (
        typeof value === "string" &&
        isVideoUrl(value)
      ) {
        return value;
      }

    }

    return null;
  }

  function findVideoUrlDeep(
    object,
    depth = 0
  ) {

    if (
      depth >
      6 ||
      object === null ||
      object === undefined
    ) {
      return null;
    }

    if (
      typeof object === "string"
    ) {

      return isVideoUrl(object)
        ? object
        : null;

    }

    if (
      typeof object !== "object"
    ) {
      return null;
    }

    for (
      const key of Object.keys(object)
    ) {

      const value =
        object[key];

      if (
        typeof value === "string" &&
        isVideoUrl(value)
      ) {
        return value;
      }

      if (
        value &&
        typeof value === "object"
      ) {

        const found =
          findVideoUrlDeep(
            value,
            depth + 1
          );

        if (found) {
          return found;
        }

      }

    }

    return null;
  }

  function isVideoUrl(value) {

    if (
      typeof value !== "string"
    ) {
      return false;
    }

    const valueLower =
      value.toLowerCase();

    return (
      valueLower.startsWith("http://") ||
      valueLower.startsWith("https://") ||
      valueLower.startsWith("blob:")
    ) &&
    (
      valueLower.includes(".mp4") ||
      valueLower.includes(".webm") ||
      valueLower.includes(".mov") ||
      valueLower.includes("video")
    );
  }

  /* =======================================================
     REQUEST ID
     ======================================================= */

  function extractRequestId(data) {

    if (!data) {
      return null;
    }

    const candidates = [
      data.request_id,
      data.requestId,
      data.id,

      data?.data?.request_id,
      data?.data?.requestId,

      data?.response?.request_id,
      data?.response?.requestId
    ];

    for (
      const candidate of candidates
    ) {

      if (
        typeof candidate === "string" &&
        candidate.trim()
      ) {
        return candidate;
      }

    }

    return null;
  }

  /* =======================================================
     POLLING
     ======================================================= */

  async function pollGeneration(
    requestId,
    maxAttempts = 60
  ) {

    /*
      The Worker can expose a polling endpoint.

      We first try:

        /status/:requestId

      If the Worker does not support it,
      the response will tell us.
    */

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {

      const progress =
        Math.min(
          95,
          65 +
            (
              attempt /
              maxAttempts
            ) *
              30
        );

      updateGenerationStatus(
        `Rendering video... ${Math.round(progress)}%`,
        progress
      );

      try {

        const response =
          await fetch(
            `${API_BASE}/status/${encodeURIComponent(requestId)}`,
            {
              method: "GET"
            }
          );

        const text =
          await response.text();

        let data = {};

        try {
          data =
            JSON.parse(text);
        } catch {
          data = {
            raw: text
          };
        }

        if (response.ok) {

          const videoUrl =
            extractVideoUrl(data);

          if (videoUrl) {
            return data;
          }

          const status =
            String(
              data.status ||
              data.state ||
              ""
            ).toLowerCase();

          if (
            status === "failed" ||
            status === "error"
          ) {

            throw new Error(
              data.error ||
              "Video generation failed."
            );

          }

          if (
            status === "completed" ||
            status === "complete" ||
            status === "succeeded" ||
            status === "success"
          ) {

            return data;
          }

        } else if (
          response.status !== 404
        ) {

          throw new Error(
            data.error ||
            `Status request failed (${response.status})`
          );

        }

      } catch (error) {

        /*
          If status endpoint isn't available,
          stop polling instead of creating an
          endless request loop.
        */

        if (
          error.message &&
          !error.message.includes(
            "Failed to fetch"
          )
        ) {

          if (
            error.message.includes(
              "Status request failed"
            )
          ) {
            throw error;
          }

        }

      }

      await sleep(
        3000
      );
    }

    throw new Error(
      "Video generation is taking longer than expected. Please try again in a moment."
    );
  }

  function sleep(ms) {

    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          ms
        )
    );
  }

  /* =======================================================
     GENERATED VIDEO HANDLER
     ======================================================= */

  function handleGeneratedVideo(
    videoUrl,
    responseData,
    originalPrompt
  ) {

    currentVideoUrl =
      videoUrl;

    currentVideoData = {
      url:
        videoUrl,

      response:
        responseData,

      prompt:
        originalPrompt,

      format:
        selectedFormat,

      duration:
        selectedDuration,

      createdAt:
        new Date().toISOString()
    };

    displayGeneratedVideo(
      videoUrl
    );

    saveGeneratedVideoProject(
      currentVideoData
    );

    showToast(
      "Your video is ready!"
    );
  }

  /* =======================================================
     VIDEO PREVIEW
     ======================================================= */

  function displayGeneratedVideo(
    videoUrl
  ) {

    const videoElements =
      $all(
        "#generatedVideo, .generated-video, [data-generated-video]"
      );

    videoElements.forEach(video => {

      /*
        If the target is not actually a
        <video> element, find/create one.
      */

      if (
        video.tagName &&
        video.tagName.toLowerCase() ===
          "video"
      ) {

        video.src =
          videoUrl;

        video.controls =
          true;

        video.playsInline =
          true;

        video.preload =
          "metadata";

        video.classList.add(
          "has-video"
        );

        video.load();

        return;
      }

      const existing =
        video.querySelector(
          "video"
        );

      if (existing) {

        existing.src =
          videoUrl;

        existing.load();

        return;
      }

      const newVideo =
        document.createElement(
          "video"
        );

      newVideo.src =
        videoUrl;

      newVideo.controls =
        true;

      newVideo.playsInline =
        true;

      newVideo.preload =
        "metadata";

      video.innerHTML =
        "";

      video.appendChild(
        newVideo
      );

    });

    /*
      Show preview containers.
    */

    $all(
      ".video-preview-empty, .generated-video-empty"
    ).forEach(element => {
      element.classList.add(
        "hidden"
      );
    });

    $all(
      ".video-preview-result, .generated-video-result"
    ).forEach(element => {
      element.classList.remove(
        "hidden"
      );
      element.classList.add(
        "active"
      );
    });

  }

  /* =======================================================
     DOWNLOAD VIDEO
     ======================================================= */

  async function downloadGeneratedVideo() {

    if (!currentVideoUrl) {

      showToast(
        "Generate a video first."
      );

      return;
    }

    try {

      showToast(
        "Preparing download..."
      );

      const response =
        await fetch(
          currentVideoUrl
        );

      if (!response.ok) {
        throw new Error(
          "Could not download video."
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        `vibenest-video-${Date.now()}.mp4`;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(
        url
      );

      showToast(
        "Video download started."
      );

    } catch (error) {

      console.error(
        error
      );

      /*
        If CORS blocks fetching the video,
        fallback to opening the URL.
      */

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        currentVideoUrl;

      anchor.target =
        "_blank";

      anchor.rel =
        "noopener noreferrer";

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      showToast(
        "Opened the video in a new tab."
      );
    }
  }

  /* =======================================================
     FULLSCREEN PREVIEW
     ======================================================= */

  function toggleFullscreenPreview() {

    const video =
      document.querySelector(
        "#generatedVideo, .generated-video video, [data-generated-video] video"
      );

    if (!video) {

      showToast(
        "Generate a video first."
      );

      return;
    }

    if (
      document.fullscreenElement
    ) {

      document.exitFullscreen();

      return;
    }

    if (
      typeof video.requestFullscreen ===
      "function"
    ) {

      video.requestFullscreen();

    } else {

      showToast(
        "Fullscreen is not supported by this browser."
      );

    }
  }

  /* =======================================================
     AI EDIT
     ======================================================= */

  async function runAIEdit() {

    if (!currentVideoUrl) {

      showToast(
        "Generate or import a video first."
      );

      return;
    }

    const input =
      document.querySelector(
        "#aiEditPrompt, #videoAIEditPrompt, [name='aiEditPrompt']"
      );

    const command =
      input
        ? input.value.trim()
        : "";

    if (!command) {

      showToast(
        "Tell VibeNest what you want to change."
      );

      if (input) {
        input.focus();
      }

      return;
    }

    /*
      AI editing is intentionally not faked.

      If the backend later exposes an /edit endpoint,
      this function can call it.

      For now we report the state honestly.
    */

    showToast(
      "AI Edit command received. Backend editing endpoint is not connected yet."
    );

    console.info(
      "AI Edit:",
      {
        video:
          currentVideoUrl,

        command
      }
    );
  }

  /* =======================================================
     LOCAL VIDEO IMPORT
     ======================================================= */

  function handleVideoFile(
    file
  ) {

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "video/"
      )
    ) {

      showToast(
        "Please select a video file."
      );

      return;
    }

    if (
      file.size >
      MAX_LOCAL_FILE_SIZE
    ) {

      showToast(
        "This video is too large. Maximum supported size is 250 MB."
      );

      return;
    }

    const url =
      URL.createObjectURL(
        file
      );

    const media = {
      id:
        `media_${Date.now()}`,

      file,

      name:
        file.name,

      type:
        file.type,

      size:
        file.size,

      url
    };

    uploadedMedia.push(
      media
    );

    displayImportedVideo(
      media
    );

    showToast(
      `${file.name} imported`
    );
  }

  function displayImportedVideo(
    media
  ) {

    const containers =
      $all(
        "#videoMediaLibrary, .video-media-library, [data-video-media-library]"
      );

    containers.forEach(container => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "media-library-item";

      item.dataset.mediaId =
        media.id;

      item.innerHTML =
        `
          <div class="media-thumbnail">
            <video
              src="${media.url}"
              muted
              playsinline
              preload="metadata"
            ></video>
          </div>

          <div class="media-info">

            <strong>
              ${escapeHTML(media.name)}
            </strong>

            <span>
              ${formatFileSize(media.size)}
            </span>

          </div>

          <button
            type="button"
            class="media-add-button"
            data-media-id="${escapeHTML(media.id)}"
          >
            Add
          </button>
        `;

      container.appendChild(
        item
      );

    });
  }

  function formatFileSize(
    bytes
  ) {

    if (
      !Number.isFinite(bytes) ||
      bytes <= 0
    ) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB"
    ];

    const index =
      Math.floor(
        Math.log(bytes) /
        Math.log(1024)
      );

    return (
      Math.round(
        (
          bytes /
          Math.pow(
            1024,
            index
          )
        ) * 10
      ) / 10
    ) +
      " " +
      units[
        Math.min(
          index,
          units.length - 1
        )
      ];
  }

  /* =======================================================
     SAVE VIDEO PROJECT
     ======================================================= */

  function saveGeneratedVideoProject(
    videoData
  ) {

    if (
      !window.VibeNestProjects
    ) {
      return;
    }

    const project =
      window.VibeNestProjects.createProject({
        name:
          "AI Video",

        type:
          selectedFormat === "9:16"
            ? "reel"
            : "video",

        description:
          videoData.prompt,

        thumbnail:
          "",

        data: {
          videoUrl:
            videoData.url,

          prompt:
            videoData.prompt,

          format:
            videoData.format,

          duration:
            videoData.duration,

          providerResponse:
            videoData.response
        },

        tags: [
          "ai",
          "video"
        ]
      });

    if (project) {

      console.log(
        "VibeNest video project saved:",
        project
      );

    }
  }

  /* =======================================================
     VIDEO CHIP / PRESET
     ======================================================= */

  function selectChip(element) {

    if (!element) {
      return;
    }

    const group =
      element.closest(
        ".chip-group, .prompt-chips, .video-chips"
      );

    if (group) {

      group
        .querySelectorAll(
          ".chip"
        )
        .forEach(chip => {
          chip.classList.remove(
            "active"
          );
        });

    }

    element.classList.add(
      "active"
    );

    const value =
      element.dataset.value ||
      element.textContent.trim();

    const prompt =
      getVideoPrompt();

    if (
      prompt &&
      !prompt.toLowerCase().includes(
        value.toLowerCase()
      )
    ) {

      setVideoPrompt(
        `${prompt}, ${value}`
      );

    } else if (!prompt) {

      setVideoPrompt(
        value
      );

    }
  }

  /* =======================================================
     VIDEO SETTINGS
     ======================================================= */

  function getVideoSettings() {

    return {
      prompt:
        getVideoPrompt(),

      format:
        selectedFormat,

      duration:
        selectedDuration
    };
  }

  /* =======================================================
     RESET
     ======================================================= */

  function resetVideoStudio() {

    setVideoPrompt(
      ""
    );

    selectedFormat =
      "9:16";

    selectedDuration =
      DEFAULT_DURATION;

    currentVideoUrl =
      "";

    currentVideoData =
      null;

    uploadedMedia.forEach(
      media => {
        try {
          URL.revokeObjectURL(
            media.url
          );
        } catch {}
      }
    );

    uploadedMedia =
      [];

    selectVideoFormat(
      "9:16"
    );

    selectVideoDuration(
      DEFAULT_DURATION
    );

    const generated =
      document.querySelector(
        "#generatedVideo"
      );

    if (generated) {
      generated.removeAttribute(
        "src"
      );
      generated.load();
    }

    showToast(
      "Video Studio reset."
    );
  }

  /* =======================================================
     DRAG & DROP
     ======================================================= */

  function setupVideoDropZones() {

    const zones =
      $all(
        ".video-drop-zone, [data-video-drop-zone]"
      );

    zones.forEach(zone => {

      zone.addEventListener(
        "dragover",
        event => {

          event.preventDefault();

          zone.classList.add(
            "dragover"
          );

        }
      );

      zone.addEventListener(
        "dragleave",
        () => {

          zone.classList.remove(
            "dragover"
          );

        }
      );

      zone.addEventListener(
        "drop",
        event => {

          event.preventDefault();

          zone.classList.remove(
            "dragover"
          );

          const files =
            event.dataTransfer.files;

          if (
            files &&
            files.length
          ) {

            handleVideoFile(
              files[0]
            );

          }

        }
      );

    });

  }

  /* =======================================================
     FILE INPUT
     ======================================================= */

  function setupVideoFileInputs() {

    $all(
      "input[type='file'][accept*='video']"
    ).forEach(input => {

      input.addEventListener(
        "change",
        event => {

          const file =
            event.target.files?.[0];

          if (file) {
            handleVideoFile(
              file
            );
          }

          input.value =
            "";

        }
      );

    });

  }

  /* =======================================================
     BUTTON EVENTS
     ======================================================= */

  function setupVideoEvents() {

    document.addEventListener(
      "click",
      event => {

        const formatButton =
          event.target.closest(
            "[data-format]"
          );

        if (
          formatButton &&
          (
            formatButton.closest(
              ".video-format-selector"
            ) ||
            formatButton.closest(
              ".format-selector"
            )
          )
        ) {

          selectVideoFormat(
            formatButton.dataset.format
          );

          return;
        }

        const durationButton =
          event.target.closest(
            "[data-duration]"
          );

        if (
          durationButton
        ) {

          selectVideoDuration(
            durationButton.dataset.duration
          );

          return;
        }

        const chip =
          event.target.closest(
            ".video-chip, .prompt-chip"
          );

        if (chip) {

          selectChip(
            chip
          );

          return;
        }

        const addMedia =
          event.target.closest(
            ".media-add-button"
          );

        if (addMedia) {

          const id =
            addMedia.dataset.mediaId;

          const media =
            uploadedMedia.find(
              item =>
                item.id === id
            );

          if (media) {

            /*
              If the editor has a media
              insertion function, use it.
            */

            if (
              typeof window.addMediaToTimeline ===
              "function"
            ) {

              window.addMediaToTimeline(
                media
              );

            } else {

              showToast(
                `${media.name} ready to add to the timeline`
              );

            }

          }

          return;
        }

      }
    );

  }

  /* =======================================================
     PREVIEW VIDEO EVENTS
     ======================================================= */

  function setupPreviewEvents() {

    document.addEventListener(
      "loadedmetadata",
      event => {

        const video =
          event.target;

        if (
          !video.matches(
            "#generatedVideo, .generated-video video"
          )
        ) {
          return;
        }

        /*
          Keep preview visually consistent.
        */

        video.dataset.aspectRatio =
          selectedFormat;

      },
      true
    );

  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.VibeNestVideo = {

    generateVideo,

    selectVideoFormat,

    selectVideoDuration,

    downloadGeneratedVideo,

    toggleFullscreenPreview,

    runAIEdit,

    handleVideoFile,

    getVideoPrompt,

    setVideoPrompt,

    getVideoSettings,

    resetVideoStudio,

    getCurrentVideo: () => ({
      url:
        currentVideoUrl,

      data:
        currentVideoData
    }),

    getUploadedMedia: () =>
      uploadedMedia
  };

  /*
    Functions referenced directly by index.html.
  */

  window.generateVideo =
    generateVideo;

  window.selectVideoFormat =
    selectVideoFormat;

  window.selectVideoDuration =
    selectVideoDuration;

  window.downloadGeneratedVideo =
    downloadGeneratedVideo;

  window.toggleFullscreenPreview =
    toggleFullscreenPreview;

  window.runAIEdit =
    runAIEdit;

  window.handleVideoFile =
    handleVideoFile;

  window.selectChip =
    selectChip;

  /* =======================================================
     INITIALIZATION
     ======================================================= */

  function initVideoStudio() {

    setupVideoDropZones();

    setupVideoFileInputs();

    setupVideoEvents();

    setupPreviewEvents();

    selectVideoFormat(
      selectedFormat
    );

    selectVideoDuration(
      selectedDuration
    );

    console.log(
      "VibeNest Video Studio initialized."
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initVideoStudio
    );

  } else {

    initVideoStudio();

  }

})();
