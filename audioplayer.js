define(function(require, exports, module) {
    main.consumes = [
        "dialog.alert", "dialog.error", "Editor", "editors", "Previewer", "ui",
        "vfs", "watcher"
    ];
    
    main.provides = ["c9.ide.cs50.audioplayer"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
    
        var editors = imports.editors;
        var ui = imports.ui;
        var vfs = imports.vfs;
        var showAlert = imports["dialog.alert"].show;
        var showError = imports["dialog.error"].show;
        var watcher = imports.watcher;
        
        var basename = require("path").basename;
        
        var extensions = ["mp3", "ogg", "wav"];
        var handle = editors.register(
            "audioplayer", "Audio Player", AudioPlayer, extensions
        );
        
        /**
         * Creates factory for editor.
         */
        function AudioPlayer() {
            var plugin = new Editor("CS50", main.consumes, extensions);
            var container, audio;
            
            plugin.on("draw", function(e) {
                container = e.htmlNode;
                ui.insertHtml(
                    container, require("text!./audioplayer.html"), plugin
                );
                audio = container.querySelector("#audioplayer");
                
                audio.onerror = function() {
                    showError("Error opening/playing audio file.");
                };
            });
            
            // insert CSS once on draw
            plugin.once("draw", function() {
                ui.insertCss(
                    require("text!./style.css"), 
                    options.staticPrefix, 
                    handle
                );
            });
            
            /**
             * Sets/updates audio source to full path, tab title to file name,
             * and tooltip to path.
             * 
             * @param path {string} path relative to workspace.
             * @param audioDoc {Document} audio Document.
             */
            function setPath(path, audioDoc) {
                if (!path) {
                    return;
                }
                
                var fullPath = path.match(/^\w+:\/\//) ? path : vfs.url(path);
                if (audio.src == fullPath) {
                    return;
                }
                
                // set/update src URL and reload
                audio.src = fullPath;
                audio.load();
                
                // watch file for renaming externally or removal
                watcher.watch(path);
                
                // set/update tab title and tooltip
                audioDoc.title = basename(path);
                audioDoc.tooltip = path;
            }
            
            // handle audio file when first opened
            plugin.on("documentLoad", function(e) {
                var audioDoc = e.doc;
                var session = audioDoc.getSession();
                
                // handle renaming file from tree while open
                audioDoc.tab.on("setPath", function(e) {
                    setPath(e.path, audioDoc);
                }, session);
                
                // play audio
                audioDoc.on("setValue", function(e) {
                    var path = audioDoc.tab.path;
                    setPath(path, audioDoc);
                    audio.play();
                }, session);
                
                // close tab if file no longer available
                watcher.on("delete", function(e) {
                    watcher.unwatch(e.path);
                    if (audioDoc.tab) {
                        showAlert(
                            "File no longer available", 
                            e.path + " was removed or no longer available.",
                            null,
                            function() {
                                audioDoc.tab.close();    
                            }
                        );
                    }
                });
            });
            
            // handle when tab becomes active (e.g., after refresh)
            plugin.on("documentActivate", function(e) {
                var audioDoc = e.doc;
                var path = audioDoc.tab.path;
                setPath(path, audioDoc);
            });
            
            plugin.freezePublicAPI({});
        
            plugin.load(null, "c9.ide.cs50.audioplayer");
        
            return plugin;    
        }
        
        register(null, {
            "c9.ide.cs50.audioplayer": handle
        });
    }
});