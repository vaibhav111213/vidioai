/* =========================================================
   VIBENEST — PROJECTS SYSTEM
   Handles:
   - Project creation
   - Project storage
   - Recent projects
   - Project cards
   - Templates
   - Rename / delete
   - Save project state
   - Local browser storage
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "vibenest_projects";
  const ACTIVE_PROJECT_KEY = "vibenest_active_project";

  /* ---------------------------------------------------------
     BASIC HELPERS
     --------------------------------------------------------- */

  function getProjects() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return [];
      }

      const projects = JSON.parse(saved);

      return Array.isArray(projects) ? projects : [];
    } catch (error) {
      console.error("VibeNest: Could not load projects", error);
      return [];
    }
  }

  function saveProjects(projects) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (error) {
      console.error("VibeNest: Could not save projects", error);
      return false;
    }
  }

  function createId() {
    return (
      "project_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).substring(2, 9)
    );
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(date) {
    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
      return "Recently";
    }

    const now = new Date();
    const diff = now - d;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) {
      return "Just now";
    }

    if (diff < hour) {
      const minutes = Math.floor(diff / minute);
      return `${minutes} min ago`;
    }

    if (diff < day) {
      const hours = Math.floor(diff / hour);
      return `${hours} hr ago`;
    }

    if (diff < 7 * day) {
      const days = Math.floor(diff / day);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }

    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getProjectIcon(type) {
    const icons = {
      video: "🎬",
      reel: "📱",
      image: "🖼️",
      photobooth: "📸",
      voice: "🎙️",
      presentation: "📊",
      document: "📄",
      whiteboard: "🧠",
      thumbnail: "🎨",
      copywriter: "✍️",
      resume: "📋",
      planner: "📅",
      compression: "🗜️",
      enhance: "✨",
      ai: "✦",
      default: "✦"
    };

    return icons[type] || icons.default;
  }

  function getProjectTypeLabel(type) {
    const labels = {
      video: "Video",
      reel: "Instagram Reel",
      image: "Image",
      photobooth: "Photo Booth",
      voice: "Voice",
      presentation: "Presentation",
      document: "Document",
      whiteboard: "Whiteboard",
      thumbnail: "Thumbnail",
      copywriter: "AI Copywriter",
      resume: "Resume",
      planner: "Content Planner",
      compression: "Compression",
      enhance: "Enhancer",
      ai: "AI Project",
      default: "Project"
    };

    return labels[type] || labels.default;
  }

  /* ---------------------------------------------------------
     CREATE PROJECT
     --------------------------------------------------------- */

  function createProject(options = {}) {
    const now = new Date().toISOString();

    const project = {
      id: options.id || createId(),

      name:
        options.name ||
        "Untitled Project",

      type:
        options.type ||
        "default",

      description:
        options.description ||
        "",

      createdAt:
        options.createdAt ||
        now,

      updatedAt:
        options.updatedAt ||
        now,

      thumbnail:
        options.thumbnail ||
        "",

      data:
        options.data ||
        {},

      status:
        options.status ||
        "draft",

      favorite:
        Boolean(options.favorite),

      tags:
        Array.isArray(options.tags)
          ? options.tags
          : [],

      duration:
        options.duration ||
        0,

      size:
        options.size ||
        0
    };

    const projects = getProjects();

    projects.unshift(project);

    saveProjects(projects);

    setActiveProject(project.id);

    renderRecentProjects();
    renderProjectsPage();

    return project;
  }

  /* ---------------------------------------------------------
     GET PROJECT
     --------------------------------------------------------- */

  function getProject(projectId) {
    const projects = getProjects();

    return projects.find(
      project => project.id === projectId
    ) || null;
  }

  /* ---------------------------------------------------------
     UPDATE PROJECT
     --------------------------------------------------------- */

  function updateProject(projectId, updates = {}) {
    const projects = getProjects();

    const index = projects.findIndex(
      project => project.id === projectId
    );

    if (index === -1) {
      return null;
    }

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    saveProjects(projects);

    renderRecentProjects();
    renderProjectsPage();

    return projects[index];
  }

  /* ---------------------------------------------------------
     DELETE PROJECT
     --------------------------------------------------------- */

  function deleteProject(projectId) {
    const projects = getProjects();

    const project = projects.find(
      item => item.id === projectId
    );

    if (!project) {
      return false;
    }

    const confirmed = window.confirm(
      `Delete "${project.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return false;
    }

    const remaining = projects.filter(
      item => item.id !== projectId
    );

    saveProjects(remaining);

    if (getActiveProjectId() === projectId) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }

    renderRecentProjects();
    renderProjectsPage();

    showProjectToast("Project deleted");

    return true;
  }

  /* ---------------------------------------------------------
     RENAME PROJECT
     --------------------------------------------------------- */

  function renameProject(projectId) {
    const project = getProject(projectId);

    if (!project) {
      return;
    }

    const newName = window.prompt(
      "Enter a new project name:",
      project.name
    );

    if (newName === null) {
      return;
    }

    const cleanName = newName.trim();

    if (!cleanName) {
      showProjectToast("Project name cannot be empty");
      return;
    }

    updateProject(projectId, {
      name: cleanName
    });

    showProjectToast("Project renamed");
  }

  /* ---------------------------------------------------------
     FAVORITE PROJECT
     --------------------------------------------------------- */

  function toggleFavoriteProject(projectId) {
    const project = getProject(projectId);

    if (!project) {
      return;
    }

    updateProject(projectId, {
      favorite: !project.favorite
    });

    showProjectToast(
      project.favorite
        ? "Removed from favorites"
        : "Added to favorites"
    );
  }

  /* ---------------------------------------------------------
     ACTIVE PROJECT
     --------------------------------------------------------- */

  function setActiveProject(projectId) {
    if (!projectId) {
      return;
    }

    localStorage.setItem(
      ACTIVE_PROJECT_KEY,
      projectId
    );
  }

  function getActiveProjectId() {
    return localStorage.getItem(
      ACTIVE_PROJECT_KEY
    );
  }

  function getActiveProject() {
    const id = getActiveProjectId();

    if (!id) {
      return null;
    }

    return getProject(id);
  }

  /* ---------------------------------------------------------
     OPEN PROJECT
     --------------------------------------------------------- */

  function openProject(projectId) {
    const project = getProject(projectId);

    if (!project) {
      showProjectToast("Project not found");
      return;
    }

    setActiveProject(project.id);

    /*
      If the main app has a project-opening function,
      allow it to handle the project.
    */

    if (
      typeof window.loadProjectIntoWorkspace ===
      "function"
    ) {
      window.loadProjectIntoWorkspace(project);
      return;
    }

    /*
      Otherwise navigate to the appropriate VibeNest page.
    */

    const pageMap = {
      video: "video",
      reel: "video",
      image: "image",
      photobooth: "photobooth",
      voice: "voice",
      presentation: "presentation",
      document: "documents",
      whiteboard: "whiteboard",
      thumbnail: "thumbnail",
      copywriter: "copywriter",
      resume: "resume",
      planner: "planner",
      compression: "compress",
      enhance: "enhance",
      ai: "ai"
    };

    const target =
      pageMap[project.type];

    if (
      target &&
      typeof window.navigate === "function"
    ) {
      window.navigate(target);
    }

    showProjectToast(
      `Opened ${project.name}`
    );
  }

  /* ---------------------------------------------------------
     PROJECT CARD
     --------------------------------------------------------- */

  function projectCardHTML(project) {
    const icon = getProjectIcon(project.type);

    const typeLabel =
      getProjectTypeLabel(project.type);

    const thumbnail = project.thumbnail
      ? `
        <img
          src="${escapeHTML(project.thumbnail)}"
          alt="${escapeHTML(project.name)}"
          loading="lazy"
        >
      `
      : `
        <div class="project-placeholder">
          <span>${icon}</span>
        </div>
      `;

    return `
      <article
        class="project-card"
        data-project-id="${escapeHTML(project.id)}"
      >

        <button
          class="project-preview"
          type="button"
          onclick="openProject('${escapeHTML(project.id)}')"
          aria-label="Open ${escapeHTML(project.name)}"
        >
          ${thumbnail}

          <div class="project-preview-overlay">
            <span class="project-open-icon">
              ↗
            </span>
          </div>
        </button>

        <div class="project-card-body">

          <div class="project-card-heading">

            <div>
              <h3>
                ${escapeHTML(project.name)}
              </h3>

              <span class="project-type">
                ${escapeHTML(typeLabel)}
              </span>
            </div>

            <button
              class="project-menu-button"
              type="button"
              onclick="toggleProjectMenu('${escapeHTML(project.id)}', event)"
              aria-label="Project options"
            >
              ⋮
            </button>

          </div>

          <div class="project-card-footer">

            <span class="project-date">
              ${formatDate(project.updatedAt)}
            </span>

            ${
              project.favorite
                ? `
                  <span
                    class="project-favorite"
                    title="Favorite"
                  >
                    ★
                  </span>
                `
                : ""
            }

          </div>

        </div>

        <div
          class="project-context-menu"
          id="project-menu-${escapeHTML(project.id)}"
        >

          <button
            type="button"
            onclick="openProject('${escapeHTML(project.id)}')"
          >
            Open
          </button>

          <button
            type="button"
            onclick="renameProject('${escapeHTML(project.id)}')"
          >
            Rename
          </button>

          <button
            type="button"
            onclick="toggleFavoriteProject('${escapeHTML(project.id)}')"
          >
            ${
              project.favorite
                ? "Remove Favorite"
                : "Add to Favorites"
            }
          </button>

          <button
            type="button"
            class="danger"
            onclick="deleteProject('${escapeHTML(project.id)}')"
          >
            Delete
          </button>

        </div>

      </article>
    `;
  }

  /* ---------------------------------------------------------
     RECENT PROJECTS
     --------------------------------------------------------- */

  function renderRecentProjects() {
    const containers = document.querySelectorAll(
      "#recentProjectsGrid, .recent-projects-grid"
    );

    if (!containers.length) {
      return;
    }

    const projects =
      getProjects()
        .sort(
          (a, b) =>
            new Date(b.updatedAt) -
            new Date(a.updatedAt)
        )
        .slice(0, 6);

    containers.forEach(container => {

      if (!projects.length) {

        container.innerHTML = `
          <div class="projects-empty">
            <div class="empty-icon">
              ✦
            </div>

            <h3>
              Your projects will appear here
            </h3>

            <p>
              Start creating something in VibeNest.
            </p>

            <button
              type="button"
              class="btn btn-primary"
              onclick="openCreateMenu()"
            >
              Create Something
            </button>
          </div>
        `;

        return;
      }

      container.innerHTML =
        projects
          .map(projectCardHTML)
          .join("");

    });
  }

  /* ---------------------------------------------------------
     PROJECTS PAGE
     --------------------------------------------------------- */

  function renderProjectsPage(filter = "all") {

    const container =
      document.querySelector(
        "#projectsGrid"
      );

    if (!container) {
      return;
    }

    let projects =
      getProjects();

    if (filter === "favorites") {
      projects =
        projects.filter(
          project => project.favorite
        );
    }

    if (filter !== "all") {
      const validTypes = [
        "video",
        "reel",
        "image",
        "photobooth",
        "voice",
        "presentation",
        "document",
        "whiteboard",
        "thumbnail",
        "copywriter",
        "resume",
        "planner"
      ];

      if (validTypes.includes(filter)) {
        projects =
          projects.filter(
            project =>
              project.type === filter
          );
      }
    }

    projects.sort(
      (a, b) =>
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
    );

    if (!projects.length) {

      container.innerHTML = `
        <div class="projects-empty large">
          <div class="empty-icon">
            ✦
          </div>

          <h2>
            No projects yet
          </h2>

          <p>
            Your creations will appear here.
          </p>

          <button
            type="button"
            class="btn btn-primary"
            onclick="openCreateMenu()"
          >
            Create Your First Project
          </button>
        </div>
      `;

      return;
    }

    container.innerHTML =
      projects
        .map(projectCardHTML)
        .join("");
  }

  /* ---------------------------------------------------------
     SEARCH PROJECTS
     --------------------------------------------------------- */

  function searchProjects(query) {

    const search =
      String(query || "")
        .trim()
        .toLowerCase();

    const projects =
      getProjects();

    if (!search) {
      return projects;
    }

    return projects.filter(project => {

      const name =
        String(project.name || "")
          .toLowerCase();

      const description =
        String(project.description || "")
          .toLowerCase();

      const type =
        String(project.type || "")
          .toLowerCase();

      const tags =
        Array.isArray(project.tags)
          ? project.tags.join(" ").toLowerCase()
          : "";

      return (
        name.includes(search) ||
        description.includes(search) ||
        type.includes(search) ||
        tags.includes(search)
      );
    });
  }

  /* ---------------------------------------------------------
     DUPLICATE PROJECT
     --------------------------------------------------------- */

  function duplicateProject(projectId) {

    const original =
      getProject(projectId);

    if (!original) {
      return null;
    }

    const duplicate =
      createProject({
        ...original,

        id: createId(),

        name:
          `${original.name} Copy`,

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString(),

        favorite: false
      });

    showProjectToast(
      "Project duplicated"
    );

    return duplicate;
  }

  /* ---------------------------------------------------------
     SAVE CURRENT WORKSPACE
     --------------------------------------------------------- */

  function saveCurrentWorkspace(data = {}) {

    const active =
      getActiveProject();

    if (!active) {
      return null;
    }

    return updateProject(
      active.id,
      {
        data: {
          ...active.data,
          ...data
        }
      }
    );
  }

  /* ---------------------------------------------------------
     CREATE PROJECT FROM TOOL
     --------------------------------------------------------- */

  function createToolProject(
    type,
    name,
    data = {}
  ) {

    const project =
      createProject({
        name:
          name ||
          `New ${getProjectTypeLabel(type)}`,

        type,

        data
      });

    return project;
  }

  /* ---------------------------------------------------------
     TEMPLATES
     --------------------------------------------------------- */

  const templates = [

    {
      id: "template-reel",
      name: "Instagram Reel",
      type: "reel",
      description:
        "Create a vertical short-form video.",
      icon: "📱"
    },

    {
      id: "template-cinematic",
      name: "Cinematic Video",
      type: "video",
      description:
        "Create a cinematic AI video.",
      icon: "🎬"
    },

    {
      id: "template-social-post",
      name: "Social Media Post",
      type: "image",
      description:
        "Create an eye-catching social post.",
      icon: "🖼️"
    },

    {
      id: "template-photobooth",
      name: "AI Photo Booth",
      type: "photobooth",
      description:
        "Transform your photo with AI styles.",
      icon: "📸"
    },

    {
      id: "template-presentation",
      name: "Presentation",
      type: "presentation",
      description:
        "Create a polished presentation.",
      icon: "📊"
    },

    {
      id: "template-resume",
      name: "Professional Resume",
      type: "resume",
      description:
        "Build a clean professional resume.",
      icon: "📋"
    },

    {
      id: "template-thumbnail",
      name: "YouTube Thumbnail",
      type: "thumbnail",
      description:
        "Create a high-impact thumbnail.",
      icon: "🎨"
    },

    {
      id: "template-content-plan",
      name: "Content Plan",
      type: "planner",
      description:
        "Plan your upcoming content.",
      icon: "📅"
    }

  ];

  function getTemplates() {
    return templates;
  }

  function useTemplate(templateId) {

    const template =
      templates.find(
        item => item.id === templateId
      );

    if (!template) {
      showProjectToast(
        "Template not found"
      );

      return;
    }

    const project =
      createProject({
        name:
          template.name,

        type:
          template.type,

        description:
          template.description,

        data: {
          templateId:
            template.id,

          template:
            template
        },

        tags: [
          "template"
        ]
      });

    /*
      Navigate to the relevant tool.
    */

    if (
      typeof window.navigate ===
      "function"
    ) {

      const pageMap = {
        video: "video",
        reel: "video",
        image: "image",
        photobooth: "photobooth",
        presentation: "presentation",
        resume: "resume",
        thumbnail: "thumbnail",
        planner: "planner"
      };

      const page =
        pageMap[project.type];

      if (page) {
        window.navigate(page);
      }
    }

    showProjectToast(
      `${template.name} started`
    );
  }

  /* ---------------------------------------------------------
     RENDER TEMPLATES
     --------------------------------------------------------- */

  function renderTemplates() {

    const containers =
      document.querySelectorAll(
        "#templatesGrid, .templates-grid"
      );

    if (!containers.length) {
      return;
    }

    containers.forEach(container => {

      container.innerHTML =
        templates
          .map(template => {

            return `
              <article
                class="template-card"
                data-template-type="${escapeHTML(template.type)}"
              >

                <div class="template-preview">
                  <span class="template-icon">
                    ${template.icon}
                  </span>
                </div>

                <div class="template-body">

                  <h3>
                    ${escapeHTML(template.name)}
                  </h3>

                  <p>
                    ${escapeHTML(template.description)}
                  </p>

                  <button
                    type="button"
                    class="btn btn-secondary"
                    onclick="useTemplate('${escapeHTML(template.id)}')"
                  >
                    Use Template
                  </button>

                </div>

              </article>
            `;

          })
          .join("");

    });
  }

  /* ---------------------------------------------------------
     TEMPLATE FILTER
     --------------------------------------------------------- */

  function filterTemplates(query) {

    const search =
      String(query || "")
        .trim()
        .toLowerCase();

    const cards =
      document.querySelectorAll(
        ".template-card"
      );

    cards.forEach(card => {

      const text =
        card.textContent
          .toLowerCase();

      card.style.display =
        !search ||
        text.includes(search)
          ? ""
          : "none";

    });
  }

  /* ---------------------------------------------------------
     PROJECT MENU
     --------------------------------------------------------- */

  function toggleProjectMenu(
    projectId,
    event
  ) {

    if (event) {
      event.stopPropagation();
    }

    document
      .querySelectorAll(
        ".project-context-menu"
      )
      .forEach(menu => {

        if (
          menu.id !==
          `project-menu-${projectId}`
        ) {
          menu.classList.remove(
            "active"
          );
        }

      });

    const menu =
      document.getElementById(
        `project-menu-${projectId}`
      );

    if (menu) {
      menu.classList.toggle(
        "active"
      );
    }
  }

  /* ---------------------------------------------------------
     CLOSE MENUS
     --------------------------------------------------------- */

  function closeProjectMenus() {

    document
      .querySelectorAll(
        ".project-context-menu"
      )
      .forEach(menu => {
        menu.classList.remove(
          "active"
        );
      });

  }

  /* ---------------------------------------------------------
     TOAST
     --------------------------------------------------------- */

  function showProjectToast(message) {

    if (
      typeof window.showToast ===
      "function"
    ) {
      window.showToast(message);
      return;
    }

    let toast =
      document.getElementById(
        "vibenest-project-toast"
      );

    if (!toast) {

      toast =
        document.createElement("div");

      toast.id =
        "vibenest-project-toast";

      toast.className =
        "vibenest-toast";

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    toast.classList.add(
      "show"
    );

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(() => {

        toast.classList.remove(
          "show"
        );

      }, 2500);
  }

  /* ---------------------------------------------------------
     INITIAL PROJECT DATA
     --------------------------------------------------------- */

  function createStarterProjects() {

    const projects =
      getProjects();

    /*
      Do not repeatedly create demo projects.
      Only create starter data on a completely
      empty installation.
    */

    if (projects.length > 0) {
      return;
    }

    /*
      Keep VibeNest clean for a new user.
      No fake projects are created automatically.
    */
  }

  /* ---------------------------------------------------------
     EXPORT PROJECT DATA
     --------------------------------------------------------- */

  function exportProjects() {

    const projects =
      getProjects();

    const blob =
      new Blob(
        [
          JSON.stringify(
            projects,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "vibenest-projects.json";

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);

    showProjectToast(
      "Projects exported"
    );
  }

  /* ---------------------------------------------------------
     IMPORT PROJECT DATA
     --------------------------------------------------------- */

  function importProjectsFile(file) {

    if (!file) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload = event => {

      try {

        const imported =
          JSON.parse(
            event.target.result
          );

        if (
          !Array.isArray(imported)
        ) {
          throw new Error(
            "Invalid project file"
          );
        }

        const current =
          getProjects();

        const merged = [
          ...current
        ];

        imported.forEach(project => {

          if (
            !project.id
          ) {
            project.id =
              createId();
          }

          const existing =
            merged.find(
              item =>
                item.id ===
                project.id
            );

          if (!existing) {
            merged.push(project);
          }

        });

        saveProjects(
          merged
        );

        renderRecentProjects();
        renderProjectsPage();

        showProjectToast(
          "Projects imported successfully"
        );

      } catch (error) {

        console.error(
          error
        );

        showProjectToast(
          "Invalid project file"
        );
      }

    };

    reader.readAsText(file);
  }

  /* ---------------------------------------------------------
     PROJECT STATISTICS
     --------------------------------------------------------- */

  function getProjectStats() {

    const projects =
      getProjects();

    const stats = {
      total: projects.length,
      favorites: 0,
      videos: 0,
      images: 0,
      reels: 0,
      photobooth: 0,
      presentations: 0,
      documents: 0,
      voice: 0
    };

    projects.forEach(project => {

      if (project.favorite) {
        stats.favorites++;
      }

      if (project.type === "video") {
        stats.videos++;
      }

      if (project.type === "image") {
        stats.images++;
      }

      if (project.type === "reel") {
        stats.reels++;
      }

      if (project.type === "photobooth") {
        stats.photobooth++;
      }

      if (project.type === "presentation") {
        stats.presentations++;
      }

      if (project.type === "document") {
        stats.documents++;
      }

      if (project.type === "voice") {
        stats.voice++;
      }

    });

    return stats;
  }

  /* ---------------------------------------------------------
     GLOBAL API
     --------------------------------------------------------- */

  window.VibeNestProjects = {

    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    renameProject,
    toggleFavoriteProject,

    openProject,
    duplicateProject,

    setActiveProject,
    getActiveProjectId,
    getActiveProject,

    saveCurrentWorkspace,
    createToolProject,

    searchProjects,

    getTemplates,
    useTemplate,
    filterTemplates,

    renderRecentProjects,
    renderProjectsPage,
    renderTemplates,

    exportProjects,
    importProjectsFile,

    getProjectStats
  };

  /*
    Global functions used directly by index.html.
  */

  window.getProjects =
    getProjects;

  window.getProject =
    getProject;

  window.createProject =
    createProject;

  window.updateProject =
    updateProject;

  window.deleteProject =
    deleteProject;

  window.renameProject =
    renameProject;

  window.toggleFavoriteProject =
    toggleFavoriteProject;

  window.openProject =
    openProject;

  window.duplicateProject =
    duplicateProject;

  window.toggleProjectMenu =
    toggleProjectMenu;

  window.useTemplate =
    useTemplate;

  window.filterTemplates =
    filterTemplates;

  window.renderRecentProjects =
    renderRecentProjects;

  window.renderProjectsPage =
    renderProjectsPage;

  window.renderTemplates =
    renderTemplates;

  window.saveCurrentWorkspace =
    saveCurrentWorkspace;

  window.getActiveProject =
    getActiveProject;

  window.getProjectStats =
    getProjectStats;

  /* ---------------------------------------------------------
     DOCUMENT EVENTS
     --------------------------------------------------------- */

  document.addEventListener(
    "click",
    event => {

      const clickedMenu =
        event.target.closest(
          ".project-context-menu"
        );

      const clickedButton =
        event.target.closest(
          ".project-menu-button"
        );

      if (
        !clickedMenu &&
        !clickedButton
      ) {
        closeProjectMenus();
      }

    }
  );

  /* ---------------------------------------------------------
     INITIALIZATION
     --------------------------------------------------------- */

  function initProjects() {

    createStarterProjects();

    renderRecentProjects();
    renderProjectsPage();
    renderTemplates();

  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initProjects
    );

  } else {

    initProjects();

  }

})();
