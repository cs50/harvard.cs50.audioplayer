define(function(require, exports, module) {
    main.consumes = [
        "ace", "Editor", "editors", "dialog.error", "tabManager", "ui", "vfs"
    ];

    main.provides = ["harvard.cs50.audioplayer"];
    return main;

    function main(options, imports, register) {
        const ace = imports.ace;
        const Editor = imports.Editor;
        const editors = imports.editors;
        const showError = imports["dialog.error"].show;
        const tabManager = imports.tabManager;
        const ui = imports.ui;
        const vfs = imports.vfs;

        const basename = require("path").basename;

        // Supported extensions
        const extensions = ["mp3", "ogg", "wav"];

        // Register editor
        const handle = editors.register(
            "audioplayer", "Audio Player", AudioPlayer, extensions
        );

        /**
         * Audio player factory.
         */
        function AudioPlayer() {
            let drawn = false;
            const plugin = new Editor("CS50", main.consumes, extensions);

            let container;

            function setPath(doc) {
                doc.title = basename(doc.tab.path);
                doc.tooltip = doc.tab.path;
            }

            // Draw player
            plugin.on("draw", function(e) {
                if (drawn)
                    return;

                drawn = true;

                container = document.createElement("div");
                container.classList.add("playerwrapper");
                e.htmlNode.appendChild(container);

                ui.insertCss(
                    require("text!./style.css"),
                    options.staticPrefix,
                    handle
                );
            });

            plugin.on("documentLoad", function(e) {
                const doc = e.doc;

                // Prevent saving
                doc.meta.ignoreSave = true;

                const session = doc.getSession();

                // Create audio element for current file
                if (session.audio) {
                    return;
                }

                session.audio = document.createElement("audio");
                session.audio.setAttribute("controls", "");
                session.audio.setAttribute("controlsList", "nodownload");
                session.audio.setAttribute("preload", "");

                session.audio.addEventListener("error", function() {
                    showError("Error loading audio file");
                });

                // Update tab title and tooltip after rename
                doc.tab.on("setPath", function(e) {
                    setPath(doc);
                }, session);

                /**
                 * Updates editor's background colors
                 */
                function updateTabBackground() {
                    const tab = doc.tab;
                    const theme = ace.theme;

                    if (theme) {
                        // Update background of pane and tab
                        if (theme.bg) {
                            tab.pane.aml.$ext.style.backgroundColor = tab.backgroundColor = theme.bg;
                        }

                        // Update background of tab title
                        if (theme.isDark) {
                            tab.classList.add("dark");
                        }
                        else {
                            tab.classList.remove("dark");
                        }
                    }
                }

                // Update background colors on theme change
                ace.on("themeChange", updateTabBackground, doc);

                // Update background colors after moving tab
                tabManager.on("tabAfterReparent", function(e) {
                    if (e.tab === doc.tab) {
                        updateTabBackground();
                    }
                });

                // Initialize background colors
                updateTabBackground();
            });

            plugin.on("documentActivate", function(e) {
                const doc = e.doc;
                const session = doc.getSession();

                // Load the audio file
                if (!session.audio.src) {
                    vfs.rest(doc.tab.path, {responseType: "blob"}, function(err, res) {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        session.audio.src = window.URL.createObjectURL(res);
                    });
                }

                // Append audio element to current editor's container
                if (!container.contains(session.audio)) {
                    container.appendChild(session.audio);
                }

                // Hide current audio element if it belongs to different file
                if (container.currAudio && container.currAudio !== session.audio) {
                    container.currAudio.style.display = "none";
                }

                // Show audio element of current file
                session.audio.style.display = "initial";

                // Update current audio element in container
                container.currAudio = session.audio;
            });

            plugin.on("documentUnload", function(e) {
                const audio = e.doc.getSession().audio;
                if (audio) {
                    container.removeChild(audio);
                }
            });

            plugin.freezePublicAPI({
                autoload: false
            });

            plugin.load(null, "harvard.cs50.audioplayer");

            return plugin;
        }

        // Prevent loading data
        AudioPlayer.autoload = false;
        register(null, {
            "harvard.cs50.audioplayer": handle
        });
    }
});
