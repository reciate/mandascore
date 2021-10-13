function clearPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();

    // get the playlist
    var playlist = getParent(button, "playlistBox").playlist;

    // clear the playlist
    playlist.clear();
}

function loopPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var playlist = getParent(button, "playlistBox").playlist;

    playlist.toggleLoop(button);
}

function addToPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var playlist = getParent(button, "playlistBox").playlist;
    playlist.add();
}

function editPlaylistSaveButton(e) {
    editPlaylistSave(e.target);
}

function editPlaylistSave(button) {
    var textarea = getFirstChild(getParent(button, "playlistBox"), "playlistEditArea");
    if (textarea.exp != textarea.value) {
        textarea.playlist.import(textarea.value);
    }
    clearMenus();
    clearErrors();
}

function editPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var playlist = getParent(button, "playlistBox").playlist;

    // clear all menus
    clearMenus();
    // create a div and set some properties
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;
//    div.callback = callback

    // build the section menu out of buttons
    var textArea = document.createElement("textarea");
    textArea.className = "playlistEditArea";
    textArea.rows = "5";
    textArea.cols = "64";
    var exp = playlist.export();
    textArea.value = exp;
    textArea.exp = exp;
    textArea.playlist = playlist;
    // escape is usually ignored in text areas
    textArea.onkeydown = textAreaKeyDown;

    div.appendChild(textArea);

    var save = document.createElement("input");
    save.className = "button";
    save.value = "Save";
    save.textarea = textArea;
    save.playlist = playlist;
    save.onclick = editPlaylistSaveButton

    div.appendChild(save);


//    div.innerHTML = `<textarea id="songCode" rows="5" cols="64" onchange="editPlaylistChanged(this);"></textarea>`;

    // put the menu in the clicked button's parent and anchor it to button
    showMenu(div, getParent(button, "scoreButtonRow"), button);

    textArea.focus();
    textArea.select();
}

function textAreaKeyDown(e) {
    e = e || window.event;
    nodeName = e.target.nodeName;

    switch (e.code) {
		case "Escape" :
		    // clear any open menus on escape
		    clearMenu();
		    break;
		case "Enter" :
		case "NumpadEnter" :
		    // commit when enter is pressed
		    editPlaylistSave(e.target);
		    break;
    }
}

class Playlist {
    constructor(score) {
        // back reference to the score
        this.score = score;
        // list of playlist entries
        this.entries = Array();
        // looping state
        this.looping = false;
        // build the UI
        this.buildUI();
    }

    buildUI() {

        // this.playlistContainer = document.createElement("div");
        // this.playlistContainer.className = "playlistContainer";
        // this.playlistContainer.measure = this;

        // main container
        // this will expand vertically with the playlist
        // todo: figure out a good cross-browser way to add a scrollbar
        this.playlistBox = document.createElement("div");
        this.playlistBox.className = "playlistBox";
        this.playlistBox.id = "playlistBox";
        // back reference because why not
        this.playlistBox.playlist = this;

        // this.playlistContainer.appendChild(this.playlistBox);
        this.playlistContainer = this.playlistBox;

        // menu bar, just HTML it
        this.playlistBox.innerHTML = `
            <div class="scoreButtonRow">
                <input class="titleButton" type="submit" value="Playlist"/>
                <input class="button addButton" type="submit" value="Add" onClick="addToPlaylist(this)"/>
                <input class="button loopButton" type="submit" value="Enable" onClick="loopPlaylist(this)"/>
                <input class="button clearButton" type="submit" value="Clear" onClick="clearPlaylist(this)"/>
                <input class="button editButton" type="submit" value="Copy/Paste" onClick="editPlaylist(this)"/>
                <div class="popup">
                    <input id="playlistCopyUrlButton" class="button urlButton popup" type="submit" value="Link"
                           onClick="copyPlaylistUrl()"/>
                    <div class="popuptext" id="playlistPopupBox">
                        <input id="playlistUrlHolder" type="text" size="60" onblur="hideUrlPopup()"/>
                    </div>
                </div>
            </div>
        `;

        // get a reference to the looping toggle button
        this.loopingButton = getFirstChild(this.playlistBox, "loopButton");

        getFirstChild(this.playlistBox, "titleButton").addEventListener("click", () => { this.hide() });

        this.playlistScrollArea = document.createElement("div");
        this.playlistScrollArea.className = "playlistScrollArea";
        this.playlistBox.appendChild(this.playlistScrollArea);
    }

    hide() {
        hidePlaylist();
    }

    addSongCode(code, select, insert=true, action=true) {
        var song = new Song();
        song.parseChatLink(code);
        this.addSong(song, select, insert, action);
    }

    addSong(song, select, insert=true, action=true) {
        var index = -1;

        if (this.selected && insert) {
            // if there's a selection, the insert the new entry immediately after the selection
            index = this.entries.indexOf(this.selected) + 1;

        } else {
            index = this.entries.length;
        }

        // create a new entry
        var entry = new PlaylistEntry(song, this);

        this.addSongEntry(entry, select, index, action);
    }

    addSongEntry(entry, select, index, action=true) {
        if (index == 0) {
            this.entries.unshift(entry);
            // do the same insertion in the dom
            if (this.entries.length == 1) {
                this.playlistScrollArea.appendChild(entry.playlistEntryContainer);
            } else {
                insertBefore(entry.playlistEntryContainer, this.entries[1].playlistEntryContainer);
            }
            // renumber entries
            this.reIndex();

        } else if (index < this.entries.length) {
            this.entries.splice(index, 0, entry);
            // do the same insertion in the dom
            insertBefore(entry.playlistEntryContainer, this.entries[index+1].playlistEntryContainer);
            // renumber entries
            this.reIndex();

        } else {
            // insert at the end
            this.entries.push(entry);
            // no need to reindex the whole list
            entry.setIndex(this.entries.length);
            // insert into the dom
            this.playlistScrollArea.appendChild(entry.playlistEntryContainer);
        }

        if (action) {
            this.score.startActions();
            this.score.addAction(new addRemovePlaylistEntryAction(this, entry, index, select, true));
        }

        if (select) {
            // optionally select
            this.select(entry, true, false, action);

        } else {
            // pre-cache the section packs so we don't have hiccups during payback of a playlist
            // with section pack changes
            for (var section in entry.song.packs) {
                this.score.precacheSectionSource(section, entry.song.packs[section]);
            }
        }
        if (action) {
            this.score.endActions();
        }
    }

    removeEntry(entry, action=true) {
        // remove from the entry list
        var index = removeFromList(this.entries, entry);
        if (index >= 0) {
            if (action) {
                this.score.startActions();
                this.score.addAction(new addRemovePlaylistEntryAction(this, entry, index, this.selected == entry, false));
            }
            // remove from the dom
            deleteNode(entry.playlistEntryContainer);
            // if the entry was selected then select another entry
            if (this.selected == entry) {
                // clear selection
                this.selected = null;
                // if the playlist is nonempty, select the nearest entry
                if (this.entries.length >= 0) {
                    // select either the next entry, or the last entry if the deleted one was the last entry
                    this.select(this.entries[Math.min(index, this.entries.length - 1)], true, false, action);
                }
            }
            // renumber entries
            this.reIndex();
            if (action) {
                this.score.endActions();
            }
        }
    }

    startDrag(mte, entry) {
        // scroll speed parameters, guessed
        var maxScrollDistance = 30;
        var scrollWait = 100;

        // get the index of the entry
        var startIndex = this.entries.indexOf(entry);
        var index = startIndex;

        // get the screen coordinates of the scroll area and the entry div
        var areaRect = this.playlistScrollArea.getBoundingClientRect();
        var entryRect = entry.playlistEntryContainer.getBoundingClientRect();

        // get the relative click offset inside the entry div
        var clickOffsetX = mte.clientX - entryRect.left;
        var clickOffsetY = mte.clientY - entryRect.top;

        // build a placeholder div to keep a blank space where the entry will go
        var placeholder = document.createElement("div");
        // try our best to make the placeholder div exactly the same height as the entry div
        placeholder.innerHTML = `<span class="playlistEntryContainerPlaceholder">X↑↓`+(index+1)+entry.song.name+`</span>`;
        // start it right by the entry div
        insertAfter(placeholder, entry.playlistEntryContainer);

        // set the entry div to absolute positioning
        entry.playlistEntryContainer.className = "playlistEntryContainerDrag";
        // set the button cursor style to grabbing
        entry.grabSpan.className = "smallButtonGrabbing";

        // function to iteratively move the entry and its placeholder around the list, following the cursor
        var followPlaceholder = (mte) => {
            // calcluate the cursor position inside the scroll area
            var y2 = mte.clientY - areaRect.top - this.playlistScrollArea.scrollTop;

            var newIndex = index;
            // if we're not at the beginning and the cursor is above the placeholder
            if (index > 0 && y2 < placeholder.getBoundingClientRect().top - areaRect.top - this.playlistScrollArea.scrollTop) {
                // we need to move the placeholder up
                newIndex -= 1;
            }
            // if we're not at the end and the cursor is below the placeholder
            if (index < this.entries.length - 1 && y2 > placeholder.getBoundingClientRect().bottom - areaRect.top - this.playlistScrollArea.scrollTop) {
                // we need to move the placeholder down
                newIndex += 1;
            }
            // if there's no change in index then we're done
            if (index != newIndex) {

                this.moveEntry(entry, newIndex, index, false);

                index = newIndex;
                // remove the placeholder
                deleteNode(placeholder);
                // put the placeholder where the entry div is
                insertAfter(placeholder, entry.playlistEntryContainer);
                // yield the event handling thread so it can re-position elements
                // we'll do another iteration once that's done
                setTimeout(() => { followPlaceholder(mte); }, 1);
            }
        };

        // scrolling timeout callback
        var dragTimeout = null;

        // drag event handler
        var dragEvent = (mte) => {
            // prevent things like selecting text while dragging
            mte.preventDefault();
            // move the dragged entry
            entry.playlistEntryContainer.style.left = mte.clientX - areaRect.left - clickOffsetX + this.playlistScrollArea.scrollLeft;
            entry.playlistEntryContainer.style.top = mte.clientY - areaRect.top - clickOffsetY + this.playlistScrollArea.scrollTop;

            // clear the timeout
            if (dragTimeout) {
        		clearTimeout(dragTimeout);
        		dragTimeout = null;
            }

            // get the top position of the dragged entry div
            var top = mte.clientY - clickOffsetY;
            // get the bottom position of the dragged entry div
            var bottom = mte.clientY - clickOffsetY + entryRect.height;

            var scrollAmount = 0;
            // check if the entry div is past the top of the scroll area
            if (top < areaRect.top) {
                // calculate the scroll amount based on how far the entry div is past the top of the scroll area
                scrollAmount = -maxScrollDistance * Math.min((areaRect.top - top) / entryRect.height, 1);
            }
            // check if the entry div is past the bottom of the scroll area
            if (bottom > areaRect.bottom) {
                // calculate the scroll amount based on how far the entry div is past the bottom of the scroll area
                scrollAmount = maxScrollDistance * Math.min((bottom - areaRect.bottom) / entryRect.height, 1);
            }

            // check if there is a scroll amount
            if (scrollAmount != 0) {
                // scroll the scroll area
                this.playlistScrollArea.scrollBy(0, scrollAmount);
                // scheule a timeout so the area will keep scrolling when the cursor isn't moving
                dragTimeout = setTimeout(() => { dragEvent(mte); }, scrollWait);
            }

            // move the placeholder so it's under the dragged entry
            followPlaceholder(mte);
        };

        // drop event handler
        var dropEvent =  (mte) => {
            // prevent defaults again
            mte.preventDefault();
            // reset global drag/drop listeners
            clearDragDropListeners();
            // reset the entry's style to regular positioning, it's already in the correct location in the DOM
            entry.playlistEntryContainer.className = "playlistEntryContainer";
            entry.playlistEntryContainer.style.left = "";
            entry.playlistEntryContainer.style.top = "";
            // reset the button cursor style
            entry.grabSpan.className = "smallButtonGrab";
            // remove the placeholder
            deleteNode(placeholder);
            // reindex entries
            this.reIndex();

            // clear the timeout
            if (dragTimeout) {
        		clearTimeout(dragTimeout);
        		dragTimeout = null;
            }

            if (index != startIndex) {
                this.score.startActions();
                this.score.addAction(new movePlaylistEntryAction(this, entry, startIndex, index));
                this.score.endActions();
            }
        }

        // setup global drag/drop listeners
        setupDragDropListeners(dragEvent, dropEvent);

        // call the drag listener right away
        dragEvent(mte);
    }

    moveEntry(entry, newIndex, oldIndex=null, action=true) {
        // get the index of the entry, if not provided
        if (oldIndex == null) {
            oldIndex = this.entries.indexOf(entry);
        }

        if (action) {
            this.score.startActions();
            this.score.addAction(new movePlaylistEntryAction(this, entry, oldIndex, newIndex));
        }

        // move the entry to the new index
        this.entries.splice(oldIndex, 1);
        this.entries.splice(newIndex, 0, entry);
        // remove the entry div
        deleteNode(entry.playlistEntryContainer);
        // use insertBefore unless it's at the end of the list
        if (newIndex < this.entries.length - 1) {
            insertBefore(entry.playlistEntryContainer, this.entries[newIndex + 1].playlistEntryContainer);
        } else {
            insertAfter(entry.playlistEntryContainer, this.entries[newIndex - 1].playlistEntryContainer);
        }

        if (action) {
            this.score.endActions();
        }
    }

    reIndex() {
        // lazy, just loop through and re-index eveything.
        for (var i = 0; i < this.entries.length; i++) {
            this.entries[i].setIndex(i + 1);
        }
    }

    select(entry, setScore, resetPlayback=false, action=true) {
        // already selected
        if (this.selected == entry) {
            return;
        }
        if (action) {
            this.score.startActions();
            this.score.addAction(new selectPlaylistEntryAction(this, this.selected, entry));
        }
        // check if there is already a selection
        if (this.selected) {
            // update the playlist entry's song, if this isn't an add action
            if (setScore) {
                this.selected.updateSong();
            }
            // clear selection
            this.selected.setSelected(false);
        }
        // change the selection
        this.selected = entry;
        // if there is a selection then change state
        if (entry != null) {
            // select the new entry
            entry.setSelected(true);
            // update the score, if this isn't an add action
            if (setScore) {
                // don't add undo actions for this
                this.score.setSongObject(this.selected.song, false, resetPlayback);
    //            // let's make this simple for now: switching songs in the playlist clears the undo history.
    //            clearUndoStack();
            }
        }
        if (action) {
            this.score.endActions();
        }
    }

    selectNext() {
        // if there is no selection then select the first entry
        if (!this.selected) {
            this.select(this.entries[0], true);
            return;
        }
        // get the currently selected index
        var index = this.entries.indexOf(this.selected);
        // increment and wrap around if necessary
        index += 1;
        if (index >= this.entries.length) {
            index = 0;
        }
        // change the selection, updating the score
        this.select(this.entries[index], true);
    }

    clear(action=true) {
        if (action) {
            this.score.startActions();
            this.score.addAction(new changePlaylistAction(this, this.entries, this.selected, null, null));
            this.score.endActions();
        }
        // delete from the dom
        for (var i = 0; i < this.entries.length; i++) {
            deleteNode(this.entries[i].playlistEntryContainer);
        }
        // clear state
        this.entries = Array();
        this.selected = null;
    }


    incrementName(name) {
        var incrementNameRegex = /(.*?) (\d+)/;
        var match = name.match(incrementNameRegex);
        if (match) {
            return match[1] + " " + (parseInt(match[2]) + 1);
        } else {
            return name + " " + 2;
        }
    }

    add(action=true) {
        // pull the current song from the score
        var song = this.score.getSongObject();

        // make the name unique, but don't set it yet
        var name = song.name;
        for (;;) {
            if (!this.entries.find((entry) => entry.song.name == name)) {
                break;
            }
            name = this.incrementName(name);
            song.name = name;
        }

        // add the song and automatically select it
        this.addSong(song, true, true, action);
    }

    toggleLoop() {
        this.setLooping(!this.looping)
    }

    setLooping(looping) {
        if (!looping) {
            this.loopingButton.value = "Enable";
            this.looping = false;
        } else {
            this.loopingButton.value = "Disable";
            this.looping = true;
        }
    }

    export() {
        // build a string with each playlist song's code on a new line
        var str = "";
        for (var i = 0; i < this.entries.length; i++) {
            str = str + this.entries[i].song.formatAsChatLink() + "\n";
        }
        // see if there's a mixer config to export
        var mixerString = this.score.mixer.export();
        if (mixerString != "") {
            // put the mixer config at the end
            str = str + mixerString + "\n";
        }
        return str;
    }

    import(str, action=true) {
        // split into lines
        var songCodes = str.split("\n")
        var readEntries = Array();

        var hasMixerConfig = false;
        for (var i = 0; i < songCodes.length; i++) {
            // trim and check for blank lines
            var code = songCodes[i].trim();

            // check for a mixer config
            if (this.score.mixer.isMixerExportString(code)) {
                // make sure the mixer is visible
                showMixer();
                // import the mixer config
                this.score.mixer.import(code);
                hasMixerConfig = true;

            } else if (code != "") {
                // parse the song
                var song = new Song();
                song.parseChatLink(code);
                readEntries.push(new PlaylistEntry(song, this));
            }

            if (!hasMixerConfig) {
                this.score.mixer.resetMixer();
                hideMixer();
            }
        }

        // don't make any changes if we didn't read any valid songs
        // we also avoid making any changes if there was an error parsing the song list
        if (readEntries.length > 0) {
            this.importEntries(readEntries, action);
        }
    }
    
    importEntries(entries, action=true, selectEntry=null) {
        // select the first entry and reset playback
        if (!selectEntry && entries && entries.length > 0) {
            selectEntry = entries[0];
        }
        if (action) {
            this.score.startActions();
            this.score.addAction(new changePlaylistAction(this, this.entries, this.selected, entries, selectEntry));
        }
        // clear the current playlist
        this.clear(false);
        if (entries) {
            // add each song
            for (var i = 0; i < entries.length; i++) {
                // add it to end of the playlist, without affecting the selection
                this.addSongEntry(entries[i], false, this.entries.length, false);
            }
            this.select(selectEntry, true, true, false);
        }

        if (action) {
            this.score.endActions();
        }
    }
}

class PlaylistEntry {
    constructor(song, playlist) {
        // song object
        this.song = song;
        // back reference
        this.playlist = playlist;
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // main container
        this.playlistEntryContainer = document.createElement("div");
        this.playlistEntryContainer.className = "playlistEntryContainer";
        this.playlistEntryContainer.playlist = this;

        // I kind of regret this, but build the dom manually
        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.deletePlaylistEntry
            span.entry = this;
            span.innerHTML = `X`;
            this.playlistEntryContainer.appendChild(span);
        }

        {
            this.grabSpan = document.createElement("span");
            this.grabSpan.className = "smallButtonGrab";
            this.grabSpan.onmousedown = (e) => { this.startPlayListEntryDrag(mouseEventToMTEvent(e)); }
            this.grabSpan.ontouchstart = (e) => { this.startPlayListEntryDrag(touchEventToMTEvent(e)); }
            this.grabSpan.entry = this;
            this.grabSpan.innerHTML = `↑↓`;
            this.playlistEntryContainer.appendChild(this.grabSpan);
        }

        {
            // we need to keep a reference to the index span to change its color when selected
            this.indexBar = document.createElement("span");
            this.indexBar.className = "playlistEntry";
            this.indexBar.onclick = this.selectPlaylistEntry
            this.indexBar.entry = this;
            this.playlistEntryContainer.appendChild(this.indexBar);
        }
        {
            // we need to keep a reference to the title span to change its color when selected
            this.titleBar = document.createElement("span");
            this.titleBar.className = "playlistEntry";
            this.titleBar.onclick = this.selectPlaylistEntry
            this.titleBar.entry = this;
            this.titleBar.innerHTML = this.song.getName();
            this.playlistEntryContainer.appendChild(this.titleBar);
        }
    }

    setIndex(index) {
        this.indexBar.innerHTML = index;
    }

    deletePlaylistEntry() {
        this.entry.playlist.removeEntry(this.entry);
    }

    startPlayListEntryDrag(mte) {
        this.playlist.startDrag(mte, this);
    }

    selectPlaylistEntry() {
        this.entry.playlist.select(this.entry, true);
    }

    setSelected(selected) {
        // change the css depending on whether it's selected
        this.indexBar.className = selected ? "playlistEntrySelected" : "playlistEntry";
        this.titleBar.className = selected ? "playlistEntrySelected" : "playlistEntry";
        if (selected) {
            // scroll the playlist viewer to the selected entry, either at the top or the botton, whichever is nearest
            this.playlistEntryContainer.scrollIntoView({"behavior": "auto", "block": "nearest", "inline": "nearest"});
        }
    }

    updateSong() {
        // load the current song from the score
        this.song = this.playlist.score.getSongObject();
        // update the title
        this.titleBar.innerHTML = this.song.getName();
    }
}

class selectPlaylistEntryAction extends Action {
    constructor(playlist, oldEntry, newEntry) {
        super();
        this.playlist = playlist;
        this.oldEntry = oldEntry;
        this.newEntry = newEntry;
    }

	undoAction() {
	    this.playlist.select(this.oldEntry, true, false, false);
	}

	redoAction() {
	    this.playlist.select(this.newEntry, true, false, false);
	}

	toString() {
	    return "Select " + this.newEntry.song.title;
	}
}

class addRemovePlaylistEntryAction extends Action {
    constructor(playlist, entry, index, select, add) {
        super();
        this.playlist = playlist;
        this.entry = entry;
        this.index = index;
        this.select = select;
        this.add = add;
    }

	undoAction() {
	    this.doAction(!this.add);
	}

	redoAction() {
	    this.doAction(this.add);
	}

	doAction(add) {
	    if (add) {
    	    this.playlist.addSongEntry(this.entry, this.select, this.index, false);

	    } else {
    	    this.playlist.removeEntry(this.entry, false);
	    }
	}

	toString() {
	    return (this.add ? "Add " : "Remove ") + this.entry.song.title;
	}
}

class changePlaylistAction extends Action {
    constructor(playlist, oldEntries, oldSelectedEntry, newEntries, newSelectedEntry) {
        super();
        this.playlist = playlist;
        this.oldEntries = oldEntries;
        this.oldSelectedEntry = oldSelectedEntry;
        this.newEntries = newEntries;
        this.newSelectedEntry = newSelectedEntry;
    }

	undoAction() {
	    this.playlist.importEntries(this.oldEntries, false, this.oldSelectedEntry);
	}

	redoAction() {
	    this.playlist.importEntries(this.newEntries, false, this.newSelectedEntry);
	}

	toString() {
	    return this.newEntries ? "Import playlist" : "Clear playlist";
	}
}

class movePlaylistEntryAction extends Action {
    constructor(playlist, entry, oldIndex, newIndex) {
        super();
        this.playlist = playlist;
        this.entry = entry;
        this.oldIndex = oldIndex;
        this.newIndex = newIndex;
    }

	undoAction() {
	    this.doAction(this.newIndex, this.oldIndex);
	}

	redoAction() {
	    this.doAction(this.oldIndex, this.newIndex);
	}

	doAction(fromIndex, toIndex) {
	    this.playlist.moveEntry(this.entry, toIndex, fromIndex, false);
	    this.playlist.reIndex();
	}

	toString() {
	    return (this.add ? "Add " : "Remove ") + this.entry.song.title;
	}
}

