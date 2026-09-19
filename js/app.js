/* =========================================================
   VIBENEST APP CORE
   Navigation + Modals + Home Actions
   ========================================================= */

(function () {
    "use strict";

    /* -----------------------------
       NAVIGATION
    ----------------------------- */

    window.navigate = function (pageName) {

        if (!pageName) return;

        // Hide every page
        document.querySelectorAll(".page").forEach(function (page) {
            page.classList.remove("active");
        });

        // Show requested page
        const target = document.getElementById("page-" + pageName);

        if (target) {
            target.classList.add("active");
        } else {
            console.warn("VibeNest: Page not found:", pageName);
            return;
        }

        // Update sidebar active state
        document.querySelectorAll("[data-page]").forEach(function (item) {
            item.classList.remove("active");
        });

        const activeItem = document.querySelector(
            '[data-page="' + pageName + '"]'
        );

        if (activeItem) {
            activeItem.classList.add("active");
        }

        // Close sidebar on mobile
        const sidebar = document.querySelector(".sidebar");

        if (window.innerWidth <= 900 && sidebar) {
            sidebar.classList.remove("open");
        }

        // Scroll workspace to top
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // Refresh page-specific content
        if (pageName === "projects" && typeof window.renderProjects === "function") {
            window.renderProjects();
        }

        if (pageName === "templates" && typeof window.renderTemplates === "function") {
            window.renderTemplates();
        }
    };


    /* -----------------------------
       SIDEBAR
    ----------------------------- */

    window.toggleSidebar = function () {

        const sidebar = document.querySelector(".sidebar");

        if (!sidebar) return;

        sidebar.classList.toggle("open");
    };


    /* -----------------------------
       CREATE MENU
    ----------------------------- */

    window.openCreateMenu = function () {

        const modal = document.getElementById("create-modal");

        if (modal) {
            modal.classList.add("active");
        }
    };


    window.closeModal = function (modalId) {

        const modal = document.getElementById(modalId);

        if (modal) {
            modal.classList.remove("active");
        }
    };


    window.closeModalOnBackdrop = function (event) {

        if (
            event.target.classList &&
            event.target.classList.contains("modal-backdrop")
        ) {
            event.target.classList.remove("active");
        }
    };


    /* -----------------------------
       CREATE MENU ACTION
    ----------------------------- */

    window.createFromMenu = function (type) {

        closeModal("create-modal");

        const routes = {
            video: "video",
            image: "image",
            reel: "video",
            photobooth: "photobooth",
            voice: "voice",
            presentation: "presentation",
            document: "documents",
            whiteboard: "whiteboard",
            thumbnail: "thumbnail",
            copywriter: "copywriter",
            resume: "resume"
        };

        const destination = routes[type];

        if (destination) {
            navigate(destination);
        }
    };


    /* -----------------------------
       HOME QUICK MODES
    ----------------------------- */

    window.selectHomeMode = function (mode, element) {

        document.querySelectorAll(".home-mode").forEach(function (item) {
            item.classList.remove("active");
        });

        if (element) {
            element.classList.add("active");
        }

        const prompt = document.getElementById("home-command-input");

        const placeholders = {
            auto: "What do you want to create?",
            video: "Describe the video you want to create...",
            image: "Describe the image you want to create...",
            reel: "Describe your Instagram Reel...",
            photobooth: "What should I do with your photo?",
            voice: "What would you like the voice to say?",
            presentation: "What presentation should I create?",
            document: "What document should I create?"
        };

        if (prompt) {
            prompt.placeholder =
                placeholders[mode] ||
                placeholders.auto;
        }
    };


    window.focusHomePrompt = function () {

        const input = document.getElementById("home-command-input");

        if (input) {
            input.focus();
        }
    };


    /* -----------------------------
       HOME COMMAND
    ----------------------------- */

    window.runHomeCommand = function () {

        const input = document.getElementById("home-command-input");

        if (!input) return;

        const prompt = input.value.trim();

        if (!prompt) {
            showToast("Tell VibeNest what you want to create.");
            input.focus();
            return;
        }

        // For now route based on selected mode / detected keywords
        const text = prompt.toLowerCase();

        if (
            text.includes("video") ||
            text.includes("reel") ||
            text.includes("movie")
        ) {
            navigate("video");

            const videoPrompt =
                document.getElementById("video-prompt");

            if (videoPrompt) {
                videoPrompt.value = prompt;
            }

            return;
        }

        if (
            text.includes("image") ||
            text.includes("photo") ||
            text.includes("picture")
        ) {
            navigate("image");

            const imagePrompt =
                document.getElementById("image-prompt");

            if (imagePrompt) {
                imagePrompt.value = prompt;
            }

            return;
        }

        if (
            text.includes("presentation") ||
            text.includes("ppt")
        ) {
            navigate("presentation");
            return;
        }

        if (
            text.includes("document") ||
            text.includes("pdf")
        ) {
            navigate("documents");
            return;
        }

        if (
            text.includes("voice") ||
            text.includes("audio")
        ) {
            navigate("voice");
            return;
        }

        if (
            text.includes("photo booth")
        ) {
            navigate("photobooth");
            return;
        }

        // Default
        navigate("ai");

        const aiInput =
            document.getElementById("ai-chat-input");

        if (aiInput) {
            aiInput.value = prompt;
        }
    };


    /* -----------------------------
       SEARCH
    ----------------------------- */

    window.openSearch = function () {

        const modal = document.getElementById("search-modal");

        if (modal) {
            modal.classList.add("active");

            const input =
                modal.querySelector("input");

            if (input) {
                setTimeout(function () {
                    input.focus();
                }, 100);
            }
        }
    };


    window.searchVibeNest = function () {

        const input =
            document.getElementById("search-input");

        if (!input) return;

        const query = input.value.trim().toLowerCase();

        if (!query) return;

        const pages = {
            video: "video",
            image: "image",
            photo: "photobooth",
            voice: "voice",
            presentation: "presentation",
            document: "documents",
            pdf: "documents",
            whiteboard: "whiteboard",
            thumbnail: "thumbnail",
            resume: "resume",
            planner: "planner",
            compress: "compress",
            enhance: "enhance",
            project: "projects",
            template: "templates"
        };

        for (const keyword in pages) {

            if (query.includes(keyword)) {

                closeModal("search-modal");

                navigate(pages[keyword]);

                return;
            }
        }

        showToast("No matching VibeNest tool found.");
    };


    /* -----------------------------
       UPLOAD MODAL
    ----------------------------- */

    window.openUploadModal = function () {

        const modal =
            document.getElementById("upload-modal");

        if (modal) {
            modal.classList.add("active");
        }
    };


    window.uploadAction = function (action) {

        closeModal("upload-modal");

        const input =
            document.getElementById("universal-file-input");

        if (input) {
            input.dataset.action = action;
            input.click();
        }
    };


    window.handleUniversalUpload = function (input) {

        if (!input.files || !input.files.length) {
            return;
        }

        const file = input.files[0];

        showToast(
            "Uploaded: " + file.name
        );

        const action = input.dataset.action;

        if (action === "video") {
            navigate("video");
        }

        if (action === "image") {
            navigate("image");
        }

        if (action === "photo") {
            navigate("photobooth");
        }

        input.value = "";
    };


    /* -----------------------------
       PRICING
    ----------------------------- */

    window.openPricing = function () {

        const modal =
            document.getElementById("pricing-modal");

        if (modal) {
            modal.classList.add("active");
        }
    };


    window.startCheckout = function (plan) {

        showToast(
            "Checkout for " +
            plan +
            " will be connected when payments are enabled."
        );
    };


    /* -----------------------------
       PROFILE
    ----------------------------- */

    window.openProfileMenu = function () {

        const menu =
            document.getElementById("profile-menu");

        if (menu) {
            menu.classList.toggle("active");
        }
    };


    window.closeProfileMenu = function () {

        const menu =
            document.getElementById("profile-menu");

        if (menu) {
            menu.classList.remove("active");
        }
    };


    /* -----------------------------
       TOAST
    ----------------------------- */

    window.showToast = function (message) {

        let toast =
            document.getElementById("vibenest-toast");

        if (!toast) {

            toast =
                document.createElement("div");

            toast.id = "vibenest-toast";

            toast.className = "vibenest-toast";

            document.body.appendChild(toast);
        }

        toast.textContent = message;

        toast.classList.add("show");

        clearTimeout(
            window.vibeNestToastTimer
        );

        window.vibeNestToastTimer =
            setTimeout(function () {

                toast.classList.remove("show");

            }, 3000);
    };


    /* -----------------------------
       ESC KEY
    ----------------------------- */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                document
                    .querySelectorAll(".modal-backdrop.active")
                    .forEach(function (modal) {

                        modal.classList.remove("active");

                    });

                closeProfileMenu();
            }
        }
    );


    /* -----------------------------
       BACKDROP CLICK
    ----------------------------- */

    document.addEventListener(
        "click",
        function (event) {

            if (
                event.target.classList &&
                event.target.classList.contains(
                    "modal-backdrop"
                )
            ) {

                event.target.classList.remove(
                    "active"
                );
            }
        }
    );


    /* -----------------------------
       INITIALIZATION
    ----------------------------- */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            // Make Home visible initially
            const home =
                document.getElementById(
                    "page-home"
                );

            if (home) {
                home.classList.add("active");
            }

            // Set Home as active navigation
            const homeNav =
                document.querySelector(
                    '[data-page="home"]'
                );

            if (homeNav) {
                homeNav.classList.add("active");
            }

            console.log(
                "VibeNest App initialized"
            );
        }
    );

})();
