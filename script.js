// ========================================
// macOS Desktop Portfolio — Interactions
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // -- Menu bar clock --
  const timeEl = document.getElementById('menubar-time');
  function updateTime() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    timeEl.textContent = now.toLocaleDateString('en-US', options);
  }
  updateTime();
  setInterval(updateTime, 30000);

  // -- About card toggle --
  const greetingBtn = document.getElementById('menubar-greeting');
  const aboutCard = document.getElementById('about-card');
  const cursorBubble = document.getElementById('cursor-bubble');
  greetingBtn.addEventListener('click', () => {
    const hiding = !aboutCard.classList.contains('is-hidden');
    aboutCard.classList.toggle('is-hidden');
    cursorBubble.classList.toggle('is-hidden', !hiding);
  });

  // -- Active tool state --
  let activeTool = 'cursor';
  let lastNonDrawTool = 'cursor';

  // -- Undo history --
  const undoStack = [];
  const MAX_UNDO = 50;

  function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();

    if (action.type === 'add') {
      // An element was added — remove it
      if (selectedElement === action.element) {
        selectedElement.classList.remove('is-selected');
        selectedElement = null;
      }
      action.element.remove();
    } else if (action.type === 'delete') {
      // An element was deleted — restore it
      action.parent.appendChild(action.element);
      action.element.style.transition = '';
      action.element.style.transform = '';
      action.element.style.opacity = '';
    } else if (action.type === 'move') {
      // An element was moved — restore position
      action.element.style.left = action.oldX + 'px';
      action.element.style.top = action.oldY + 'px';
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      if (document.activeElement.isContentEditable) return;
      e.preventDefault();
      undo();
    }
  });

  // -- Canvas Panning --
  const desktopArea = document.getElementById('desktop-area');
  const canvas = document.getElementById('desktop-canvas');
  let isPanning = false;
  let panStartX, panStartY;
  let canvasX = -(6000 - window.innerWidth) / 2;
  let canvasY = -(4000 - (window.innerHeight - 25)) / 2;
  canvas.style.transform = `translate(${canvasX}px, ${canvasY}px)`;
  canvas.style.transformOrigin = '0 0';

  // -- Position desktop folders relative to viewport --
  (function positionFolders() {
    const folders = document.querySelectorAll('.desktop-folder[data-col], .tools-widget[data-col]');
    if (!folders.length) return;
    const colGap = 140, rowGap = 160;
    // Spotify player right edge in canvas coords
    const playerRightCanvas = (6000 + window.innerWidth) / 2 - 16;
    // About card top in canvas coords
    const aboutTopCanvas = (4000 - (window.innerHeight - 25)) / 2 + 25 + 8 + 8;
    // Find max col to align right edge
    let maxCol = 0;
    folders.forEach(f => { maxCol = Math.max(maxCol, +f.dataset.col); });
    // Rightmost folder right edge should match playerRightCanvas
    const folderWidth = 100;
    const baseX = playerRightCanvas - (maxCol + 1) * colGap - folderWidth + colGap + 120;
    folders.forEach(f => {
      const col = +f.dataset.col;
      const row = +f.dataset.row;
      f.style.left = (baseX + col * colGap) + 'px';
      const extraOffset = f.id === 'folder-artist' ? 8 : 0;
      f.style.top = (aboutTopCanvas - 32 + row * rowGap + extraOffset) + 'px';
    });
  })();

  desktopArea.addEventListener('mousedown', (e) => {
    // Skip UI panels
    if (e.target.closest('.figjam-toolbar') || e.target.closest('.sticker-picker') || e.target.closest('.window')) return;

    if (activeTool === 'hand' || (activeTool === 'cursor' && !e.target.closest('.desktop-folder') && !e.target.closest('.sticky-note') && !e.target.closest('.desktop-item'))) {
      isPanning = true;
      panStartX = e.clientX - canvasX;
      panStartY = e.clientY - canvasY;
      deselectAll();
      desktopArea.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    canvasX = e.clientX - panStartX;
    canvasY = e.clientY - panStartY;
    applyTransform();
  });

  document.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      updateCursor();
    }
  });

  // -- Zoom (Ctrl/Cmd+scroll or pinch) --
  let zoom = 1;
  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 3;

  function applyTransform() {
    canvas.style.transform = `translate(${canvasX}px, ${canvasY}px) scale(${zoom})`;
  }

  desktopArea.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom or Ctrl+scroll
      const delta = -e.deltaY * 0.005;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));

      // Zoom toward cursor position
      const rect = desktopArea.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const scale = newZoom / zoom;
      canvasX = mx - scale * (mx - canvasX);
      canvasY = my - scale * (my - canvasY);
      zoom = newZoom;
      applyTransform();
    } else {
      // Normal scroll = pan
      canvasX -= e.deltaX;
      canvasY -= e.deltaY;
      applyTransform();
    }
  }, { passive: false });

  // -- Selection system --
  let selectedElement = null;

  function selectElement(el) {
    deselectAll();
    selectedElement = el;
    el.classList.add('is-selected');
  }

  function deselectAll() {
    if (selectedElement) {
      selectedElement.classList.remove('is-selected');
      selectedElement = null;
    }
  }

  // Click on canvas background deselects
  canvas.addEventListener('click', (e) => {
    if (e.target === canvas) deselectAll();
  });

  // Delete / Backspace removes selected element
  document.addEventListener('keydown', (e) => {
    if (!selectedElement) return;
    // Don't delete if user is typing inside a sticky note
    if (selectedElement.classList.contains('sticky-note') && selectedElement.classList.contains('is-editing')) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't interfere with text editing elsewhere
      if (document.activeElement.isContentEditable) return;

      e.preventDefault();
      const el = selectedElement;
      const parent = el.parentNode;
      pushUndo({ type: 'delete', element: el, parent: parent });
      el.style.transition = 'transform 0.2s, opacity 0.2s';
      el.style.transform = 'scale(0)';
      el.style.opacity = '0';
      selectedElement = null;
      setTimeout(() => el.remove(), 200);
    }
  });

  // -- Helpers: screen coords to canvas coords --
  function screenToCanvas(clientX, clientY) {
    const areaRect = desktopArea.getBoundingClientRect();
    return {
      x: (clientX - areaRect.left - canvasX) / zoom,
      y: (clientY - areaRect.top - canvasY) / zoom
    };
  }

  // -- About Card (always visible under menubar) --

  // -- Windows --
  const trashWindow = document.getElementById('trash-window');
  const dockTrash = document.getElementById('dock-trash');
  const trashClose = document.getElementById('trash-close');

  function openWindow(win) {
    win.classList.remove('is-closing');
    win.classList.add('is-open');
    focusWindow(win);
  }

  function closeWindow(win) {
    win.classList.add('is-closing');
    setTimeout(() => { win.classList.remove('is-open', 'is-closing'); }, 200);
  }

  function focusWindow(win) {
    document.querySelectorAll('.window').forEach(w => w.classList.remove('is-focused'));
    win.classList.add('is-focused');
  }

  dockTrash.addEventListener('click', () => {
    if (trashWindow.classList.contains('is-open')) focusWindow(trashWindow);
    else openWindow(trashWindow);
  });

  trashClose.addEventListener('click', () => closeWindow(trashWindow));
  trashWindow.addEventListener('mousedown', () => focusWindow(trashWindow));

  // -- Window Dragging --
  function makeDraggableWindow(titlebar, win) {
    let isDragging = false;
    let startX, startY, origX, origY;

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('window__btn')) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      origX = win.offsetLeft; origY = win.offsetTop;
      focusWindow(win);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      win.style.left = origX + (e.clientX - startX) + 'px';
      win.style.top = origY + (e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => { isReady = false; isDragging = false; });
  }

  makeDraggableWindow(document.getElementById('trash-titlebar'), trashWindow);

  // -- Trash items --
  const trashContent = document.getElementById('trash-content');
  const trashCountEl = document.getElementById('trash-count');
  let draggedItem = null;

  trashContent.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.trash-item');
    if (!item) return;
    draggedItem = item;
    item.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });

  trashContent.addEventListener('dragend', (e) => {
    const item = e.target.closest('.trash-item');
    if (item) item.classList.remove('is-dragging');
  });

  desktopArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  desktopArea.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedItem) return;

    const desktopItem = document.createElement('div');
    desktopItem.className = 'desktop-item';
    desktopItem.dataset.id = draggedItem.dataset.id;

    const preview = draggedItem.querySelector('.trash-item__preview').cloneNode(true);
    preview.className = 'desktop-item__preview';
    preview.innerHTML = draggedItem.querySelector('.trash-item__preview').innerHTML;

    const name = document.createElement('span');
    name.className = 'desktop-item__name';
    name.textContent = draggedItem.querySelector('.trash-item__name').textContent;

    desktopItem.appendChild(preview);
    desktopItem.appendChild(name);

    const pos = screenToCanvas(e.clientX - 50, e.clientY - 40);
    desktopItem.style.left = pos.x + 'px';
    desktopItem.style.top = pos.y + 'px';

    canvas.appendChild(desktopItem);
    makeCanvasItemDraggable(desktopItem);
    pushUndo({ type: 'add', element: desktopItem });

    draggedItem.remove();
    draggedItem = null;
    updateTrashCount();
  });

  trashContent.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  function makeCanvasItemDraggable(item) {
    let isDragging = false;
    let startX, startY, origX, origY;

    item.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      origX = parseInt(item.style.left) || 0;
      origY = parseInt(item.style.top) || 0;
      item.style.zIndex = 60;
      selectElement(item);
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      item.style.left = origX + (e.clientX - startX) + 'px';
      item.style.top = origY + (e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        item.style.zIndex = 50;
        const newX = parseInt(item.style.left) || 0;
        const newY = parseInt(item.style.top) || 0;
        if (newX !== origX || newY !== origY) {
          pushUndo({ type: 'move', element: item, oldX: origX, oldY: origY });
        }
      }
    });

    item.addEventListener('dblclick', () => returnToTrash(item));
  }

  function returnToTrash(desktopItem) {
    const id = desktopItem.dataset.id;
    const name = desktopItem.querySelector('.desktop-item__name').textContent;
    const previewHTML = desktopItem.querySelector('.desktop-item__preview').innerHTML;
    const previewClasses = {
      '1': 'trash-item__preview--ui1', '2': 'trash-item__preview--ui2',
      '3': 'trash-item__preview--illo1', '4': 'trash-item__preview--ui3',
      '5': 'trash-item__preview--illo2', '6': 'trash-item__preview--ui4'
    };

    const trashItem = document.createElement('div');
    trashItem.className = 'trash-item';
    trashItem.draggable = true;
    trashItem.dataset.id = id;

    const preview = document.createElement('div');
    preview.className = `trash-item__preview ${previewClasses[id] || ''}`;
    preview.innerHTML = previewHTML;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'trash-item__name';
    nameSpan.textContent = name;

    trashItem.appendChild(preview);
    trashItem.appendChild(nameSpan);
    trashContent.appendChild(trashItem);
    if (selectedElement === desktopItem) selectedElement = null;
    desktopItem.remove();
    updateTrashCount();
  }

  function updateTrashCount() {
    const count = trashContent.querySelectorAll('.trash-item').length;
    if (trashCountEl) trashCountEl.textContent = count;
  }
  updateTrashCount();

  // ========================================
  // Position "I'm an artist" folder above toolbar
  // ========================================
  const artistFolder = document.getElementById('folder-artist');
  if (artistFolder) {
    // Position above toolbar: toolbar is at bottom:8px left:16px, height 56px + 24px gap
    const toolbarScreenX = 16;
    const toolbarScreenY = window.innerHeight - 8 - 56 - 24 - 120;
    const pos = screenToCanvas(toolbarScreenX, toolbarScreenY);
    artistFolder.style.left = pos.x + 'px';
    artistFolder.style.top = pos.y + 'px';
  }

  // ========================================
  // Desktop Folders — draggable
  // ========================================
  document.querySelectorAll('.desktop-folder').forEach(folder => {
    let isDragging = false;
    let didMove = false;
    let startX, startY, origX, origY;

    folder.addEventListener('mousedown', (e) => {
      isDragging = true;
      didMove = false;
      startX = e.clientX; startY = e.clientY;
      origX = parseInt(folder.style.left) || 0;
      origY = parseInt(folder.style.top) || 0;
      folder.style.zIndex = 60;
      selectElement(folder);
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > 3 || dy > 3) didMove = true;
      folder.style.left = origX + (e.clientX - startX) / zoom + 'px';
      folder.style.top = origY + (e.clientY - startY) / zoom + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        folder.style.zIndex = 50;
        const newX = parseInt(folder.style.left) || 0;
        const newY = parseInt(folder.style.top) || 0;
        if (newX !== origX || newY !== origY) {
          pushUndo({ type: 'move', element: folder, oldX: origX, oldY: origY });
        }
      }
    });

    // Click to open folder link or show message (only if not dragged)
    folder.addEventListener('click', () => {
      if (didMove) return;
      // iOS-style folder — toggle expanded view
      if (folder.classList.contains('ios-folder')) {
        const expanded = folder.querySelector('.ios-folder__expanded');
        if (expanded) expanded.classList.toggle('is-open');
        return;
      }
      const href = folder.dataset.href;
      if (href) {
        const target = folder.dataset.target || '_blank';
        if (target === '_self') window.location.href = href;
        else window.open(href, target);
        return;
      }
      const msg = folder.dataset.message;
      if (msg) showFolderMessage(folder, msg);
    });
  });

  // iOS folder: stop link clicks from toggling folder & close on click outside
  document.querySelectorAll('.ios-folder__app').forEach(link => {
    link.addEventListener('click', (e) => e.stopPropagation());
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ios-folder')) {
      document.querySelectorAll('.ios-folder__expanded.is-open').forEach(el => el.classList.remove('is-open'));
    }
  });

  // Show message bubble above folder
  function showFolderMessage(folder, text) {
    const existing = folder.querySelector('.folder-message');
    if (existing) { existing.remove(); return; }
    const bubble = document.createElement('div');
    bubble.className = 'folder-message';
    bubble.innerHTML = text.replace(/\|/g, '<br>');
    folder.appendChild(bubble);
    setTimeout(() => bubble.classList.add('is-visible'), 10);
    setTimeout(() => {
      bubble.classList.remove('is-visible');
      setTimeout(() => bubble.remove(), 300);
    }, 4000);
  }

  // ========================================
  // Stickers — drag from picker to canvas
  // ========================================
  const stickerPicker = document.getElementById('sticker-picker');
  const stickerPackGrid = document.getElementById('sticker-pack-grid');
  const stickerToolBtn = document.getElementById('sticker-tool-btn');

  // Toggle sticker picker
  stickerToolBtn.addEventListener('click', (e) => {
    stickerPicker.classList.toggle('is-open');
    e.stopPropagation();
  });

  // Close sticker picker on outside click
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.figjam-toolbar__sticker-wrap')) {
      stickerPicker.classList.remove('is-open');
    }
  });

  // -- Make toolbar panels draggable --
  function makePanelDraggable(handle, panel) {
    let isReady = false;
    let isDragging = false;
    let startX, startY, origX, origY;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.figjam-toolbar__tool') || e.target.closest('.sticky-color-picker') || e.target.closest('.sticker-picker__item') || e.target.closest('.sticker-picker')) return;
      isReady = true;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      const isFixed = getComputedStyle(panel).position === 'fixed';
      if (isFixed) {
        origX = rect.left;
        origY = rect.top;
      } else {
        const areaRect = desktopArea.getBoundingClientRect();
        origX = rect.left - areaRect.left;
        origY = rect.top - areaRect.top;
      }
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isReady && !isDragging) return;
      if (isReady && !isDragging) {
        isDragging = true;
        isReady = false;
        panel.style.left = origX + 'px';
        panel.style.top = origY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
      }
      panel.style.left = origX + (e.clientX - startX) + 'px';
      panel.style.top = origY + (e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => { isReady = false; isDragging = false; });
  }

  // Drag sticker from picker
  let stickerGhost = null;
  let stickerEmoji = null;

  stickerPackGrid.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.sticker-picker__item');
    if (!btn || btn.classList.contains('sticker-picker__more')) return;

    stickerEmoji = btn.dataset.emoji;

    // Create ghost that follows cursor
    stickerGhost = document.createElement('div');
    stickerGhost.className = 'sticker sticker--ghost';
    stickerGhost.textContent = stickerEmoji;
    stickerGhost.style.position = 'fixed';
    stickerGhost.style.left = e.clientX - 20 + 'px';
    stickerGhost.style.top = e.clientY - 20 + 'px';
    stickerGhost.style.pointerEvents = 'none';
    stickerGhost.style.zIndex = '9999';
    stickerGhost.style.opacity = '0.8';
    document.body.appendChild(stickerGhost);

    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!stickerGhost) return;
    stickerGhost.style.left = e.clientX - 20 + 'px';
    stickerGhost.style.top = e.clientY - 20 + 'px';
  });

  let stickerDragged = false;

  document.addEventListener('mousemove', () => {
    if (stickerGhost) stickerDragged = true;
  });

  document.addEventListener('mouseup', (e) => {
    if (!stickerGhost) return;

    stickerGhost.remove();

    if (stickerDragged) {
      // Dropped after drag — place where released
      const areaRect = desktopArea.getBoundingClientRect();
      if (e.clientX >= areaRect.left && e.clientX <= areaRect.right &&
          e.clientY >= areaRect.top && e.clientY <= areaRect.bottom) {
        placeSticker(stickerEmoji, e.clientX, e.clientY);
      }
    } else {
      // Clicked without drag — place to the right of the toolbar
      const tbRect = figjamToolbar.getBoundingClientRect();
      const x = tbRect.right + 40 + Math.random() * 80;
      const y = tbRect.top + Math.random() * tbRect.height;
      placeSticker(stickerEmoji, x, y);
    }

    stickerGhost = null;
    stickerEmoji = null;
    stickerDragged = false;
  });

  function placeSticker(emoji, clientX, clientY) {
    const sticker = document.createElement('div');
    sticker.className = 'sticker is-landing';
    sticker.textContent = emoji;
    sticker.tabIndex = -1;

    const pos = screenToCanvas(clientX - 20, clientY - 20);
    sticker.style.left = pos.x + 'px';
    sticker.style.top = pos.y + 'px';

    const rotation = (Math.random() - 0.5) * 24;
    sticker.style.setProperty('--rotation', rotation + 'deg');

    canvas.appendChild(sticker);
    pushUndo({ type: 'add', element: sticker });
    setTimeout(() => sticker.classList.remove('is-landing'), 350);

    // Click to select
    sticker.addEventListener('mousedown', (e) => {
      selectElement(sticker);
      e.stopPropagation();
    });

    // Draggable
    makeStickerDraggable(sticker);
  }

  function makeStickerDraggable(sticker) {
    let isDragging = false;
    let startX, startY, origX, origY;

    sticker.addEventListener('mousedown', (e) => {
      if (e.target.closest('a')) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      origX = parseInt(sticker.style.left) || 0;
      origY = parseInt(sticker.style.top) || 0;
      sticker.style.zIndex = 70;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      sticker.style.left = origX + (e.clientX - startX) + 'px';
      sticker.style.top = origY + (e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        sticker.style.zIndex = 50;
        const newX = parseInt(sticker.style.left) || 0;
        const newY = parseInt(sticker.style.top) || 0;
        if (newX !== origX || newY !== origY) {
          pushUndo({ type: 'move', element: sticker, oldX: origX, oldY: origY });
        }
      }
    });
  }

  // ========================================
  // FigJam Toolbar — tools & sticky notes
  // ========================================
  const figjamToolbar = document.getElementById('figjam-toolbar');
  const toolButtons = figjamToolbar.querySelectorAll('.figjam-toolbar__tool');
  const stickyColorPicker = document.getElementById('sticky-color-picker');
  const stickyToolBtn = document.getElementById('sticky-tool-btn');

  // Make toolbar draggable
  makePanelDraggable(figjamToolbar, figjamToolbar);


  // -- Spotify widget drag --
  const spotifyWidget = document.getElementById('spotify-widget');
  if (spotifyWidget) {
    let spReady = false, spDrag = false, spStartX, spStartY, spOrigX, spOrigY;
    const spOverlay = document.createElement('div');
    spOverlay.style.cssText = 'position:absolute;inset:0;z-index:10;display:none;cursor:grabbing;border-radius:12px;';
    spotifyWidget.appendChild(spOverlay);

    spotifyWidget.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'IFRAME') return;
      spReady = true;
      spStartX = e.clientX; spStartY = e.clientY;
      const rect = spotifyWidget.getBoundingClientRect();
      spOrigX = rect.left;
      spOrigY = rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!spReady && !spDrag) return;
      const dx = e.clientX - spStartX, dy = e.clientY - spStartY;
      if (spReady && !spDrag && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        spDrag = true;
        spReady = false;
        spOverlay.style.display = 'block';
        spotifyWidget.style.right = 'auto';
        spotifyWidget.style.bottom = 'auto';
        spotifyWidget.style.left = spOrigX + 'px';
        spotifyWidget.style.top = spOrigY + 'px';
      }
      if (spDrag) {
        spotifyWidget.style.left = spOrigX + dx + 'px';
        spotifyWidget.style.top = spOrigY + dy + 'px';
      }
    });
    document.addEventListener('mouseup', () => {
      spReady = false;
      if (spDrag) { spDrag = false; spOverlay.style.display = 'none'; }
    });
  }

  // Pencil settings
  const pencilSettings = document.getElementById('pencil-settings');
  const pencilColorSwatch = document.getElementById('pencil-color-swatch');
  const pencilSizeInput = document.getElementById('pencil-size-input');
  const pencilSizeSlider = document.getElementById('pencil-size-slider');
  let pencilColor = '#1d1d1f';
  let pencilSize = 2;

  // Custom color picker
  const colorPicker = document.getElementById('color-picker');
  const cpSv = document.getElementById('cp-sv');
  const cpSvCursor = document.getElementById('cp-sv-cursor');
  const cpHue = document.getElementById('cp-hue');
  const cpHueRow = document.getElementById('cp-hue-row');
  const cpOpacity = document.getElementById('cp-opacity');
  const cpOpacityGradient = document.getElementById('cp-opacity-gradient');
  const cpOpacityLabel = document.getElementById('cp-opacity-label');
  const cpSwatches = document.getElementById('cp-swatches');

  let cpHueVal = 0, cpSat = 0, cpVal = 0.11; // initial dark color
  let cpAlpha = 1;
  let cpDraggingSV = false;

  function hsvToRgb(h, s, v) {
    let c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, v];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  function updateColorFromHSV() {
    const [r, g, b] = hsvToRgb(cpHueVal, cpSat, cpVal);
    const hex = rgbToHex(r, g, b);
    pencilColor = cpAlpha < 1
      ? `rgba(${r},${g},${b},${cpAlpha})`
      : hex;
    pencilColorSwatch.style.background = pencilColor;
    // SV area hue background
    cpSv.style.background = `hsl(${cpHueVal}, 100%, 50%)`;
    cpSvCursor.style.left = (cpSat * 100) + '%';
    cpSvCursor.style.top = ((1 - cpVal) * 100) + '%';
    cpSvCursor.style.background = hex;
    // Opacity gradient
    if (cpOpacityGradient) {
      cpOpacityGradient.style.background = `linear-gradient(to right, transparent, ${hex})`;
    }
    if (cpOpacityLabel) {
      cpOpacityLabel.textContent = Math.round(cpAlpha * 100) + '%';
    }
    // Highlight matching swatch
    if (cpSwatches) {
      cpSwatches.querySelectorAll('.color-picker__swatch').forEach(sw => {
        sw.classList.toggle('is-active', sw.dataset.color === hex);
      });
    }
  }

  function handleSVPick(e) {
    const rect = cpSv.getBoundingClientRect();
    cpSat = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    cpVal = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    updateColorFromHSV();
  }

  if (cpSv) {
    cpSv.addEventListener('mousedown', (e) => {
      cpDraggingSV = true;
      handleSVPick(e);
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (cpDraggingSV) handleSVPick(e);
    });
    document.addEventListener('mouseup', () => { cpDraggingSV = false; });
  }

  if (cpHue) {
    cpHue.addEventListener('input', (e) => {
      cpHueVal = +e.target.value;
      updateColorFromHSV();
    });
  }

  if (cpOpacity) {
    cpOpacity.addEventListener('input', (e) => {
      cpAlpha = +e.target.value / 100;
      updateColorFromHSV();
    });
  }

  // Swatch click
  if (cpSwatches) {
    cpSwatches.addEventListener('click', (e) => {
      const sw = e.target.closest('.color-picker__swatch');
      if (!sw) return;
      const color = sw.dataset.color;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const [h, s, v] = rgbToHsv(r, g, b);
      cpHueVal = h; cpSat = s; cpVal = v;
      cpHue.value = Math.round(h);
      updateColorFromHSV();
    });
  }


  // Toggle color picker from swatch
  if (pencilColorSwatch) {
    pencilColorSwatch.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPicker.classList.toggle('is-open');
    });
  }

  if (pencilSizeInput) {
    pencilSizeInput.addEventListener('input', (e) => {
      pencilSize = Math.max(1, Math.min(20, +e.target.value || 1));
      pencilSizeSlider.value = pencilSize;
    });
  }
  if (pencilSizeSlider) {
    pencilSizeSlider.addEventListener('input', (e) => {
      pencilSize = +e.target.value;
      pencilSizeInput.value = pencilSize;
    });
  }

  // Prevent drag from moving the toolbar or canvas
  [pencilSettings, colorPicker].forEach(el => {
    if (el) el.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  });

  function closeColorPicker() {
    if (colorPicker) colorPicker.classList.remove('is-open');
  }

  function closePencilSettings() {
    if (pencilSettings) pencilSettings.classList.remove('is-open');
    closeColorPicker();
  }

  // Initialize color picker display
  updateColorFromHSV();

  // Tool switching
  toolButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tool = btn.dataset.tool;
      if (tool === 'sticky') {
        stickyColorPicker.classList.toggle('is-open');
        stickerPicker.classList.remove('is-open');
        closePencilSettings();
        return;
      }
      if (tool === 'sticker') {
        // Handled by sticker-wrap listener
        return;
      }
      if (tool === 'pencil') {
        pencilSettings.classList.toggle('is-open');
        stickyColorPicker.classList.remove('is-open');
        stickerPicker.classList.remove('is-open');
        toolButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeTool = tool;
        updateCursor();
        return;
      }
      stickyColorPicker.classList.remove('is-open');
      stickerPicker.classList.remove('is-open');
      closePencilSettings();
      toolButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeTool = tool;
      if (tool === 'cursor' || tool === 'hand') lastNonDrawTool = tool;
      updateCursor();
    });
  });

  // Keyboard shortcuts for tools
  const shortcutMap = { v: 'cursor', h: 'hand', p: 'pencil', s: 'sticky', e: 'sticker' };
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Esc exits to previous tool (cursor or hand)
    if (e.key === 'Escape') {
      closePencilSettings();
      stickyColorPicker.classList.remove('is-open');
      stickerPicker.classList.remove('is-open');
      deselectAll();
      const prevTool = lastNonDrawTool || 'cursor';
      toolButtons.forEach(b => b.classList.remove('is-active'));
      const btn = figjamToolbar.querySelector(`[data-tool="${prevTool}"]`);
      if (btn) btn.classList.add('is-active');
      activeTool = prevTool;
      updateCursor();
      return;
    }
    const tool = shortcutMap[e.key.toLowerCase()];
    if (!tool) return;
    if (tool === 'sticky') {
      stickyColorPicker.classList.toggle('is-open');
      stickerPicker.classList.remove('is-open');
      return;
    }
    if (tool === 'sticker') {
      stickerPicker.classList.toggle('is-open');
      stickyColorPicker.classList.remove('is-open');
      closePencilSettings();
      return;
    }
    if (tool === 'pencil') {
      pencilSettings.classList.toggle('is-open');
      stickyColorPicker.classList.remove('is-open');
      stickerPicker.classList.remove('is-open');
      toolButtons.forEach(b => b.classList.remove('is-active'));
      const btn = figjamToolbar.querySelector(`[data-tool="${tool}"]`);
      if (btn) btn.classList.add('is-active');
      activeTool = tool;
      updateCursor();
      return;
    }
    stickyColorPicker.classList.remove('is-open');
    stickerPicker.classList.remove('is-open');
    closePencilSettings();
    toolButtons.forEach(b => b.classList.remove('is-active'));
    const btn = figjamToolbar.querySelector(`[data-tool="${tool}"]`);
    if (btn) btn.classList.add('is-active');
    activeTool = tool;
    if (tool === 'cursor' || tool === 'hand') lastNonDrawTool = tool;
    updateCursor();
  });

  // Close popups on outside click
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.figjam-toolbar__sticky-wrap')) {
      stickyColorPicker.classList.remove('is-open');
    }
    if (!e.target.closest('.figjam-toolbar__sticker-wrap')) {
      stickerPicker.classList.remove('is-open');
    }
    if (!e.target.closest('.figjam-toolbar__pencil-wrap')) {
      closePencilSettings();
    } else if (!e.target.closest('.color-picker') && !e.target.closest('.pencil-settings__color')) {
      closeColorPicker();
    }
  });

  // Custom circle cursor for pencil (8px)
  const pencilCursorSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='4' cy='4' r='3.5' fill='none' stroke='%231d1d1f' stroke-width='1'/></svg>`;
  const pencilCursorUrl = `url("data:image/svg+xml,${pencilCursorSvg}") 4 4, crosshair`;

  function updateCursor() {
    if (activeTool === 'hand') {
      desktopArea.style.cursor = 'grab';
    } else if (activeTool === 'pencil' || activeTool === 'marker') {
      desktopArea.style.cursor = pencilCursorUrl;
    } else {
      desktopArea.style.cursor = 'default';
    }
  }

  // Sticky note from color picker
  stickyColorPicker.addEventListener('mousedown', (e) => {
    const colorBtn = e.target.closest('.sticky-color-picker__color');
    if (!colorBtn) return;

    const color = colorBtn.dataset.color;
    stickyColorPicker.classList.remove('is-open');

    // Create ghost sticky note
    const ghost = document.createElement('div');
    ghost.className = 'sticky-note sticky-note--ghost';
    ghost.style.background = color;
    ghost.style.position = 'fixed';
    ghost.style.width = '120px';
    ghost.style.minHeight = '120px';
    ghost.style.left = e.clientX - 60 + 'px';
    ghost.style.top = e.clientY - 60 + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.opacity = '0.75';
    ghost.style.borderRadius = '4px';
    ghost.style.boxShadow = '2px 4px 16px rgba(0,0,0,0.2)';
    document.body.appendChild(ghost);

    let stickyGhost = ghost;
    let stickyColor = color;

    function onMove(ev) {
      stickyGhost.style.left = ev.clientX - 60 + 'px';
      stickyGhost.style.top = ev.clientY - 60 + 'px';
    }
    function onUp(ev) {
      stickyGhost.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const areaRect = desktopArea.getBoundingClientRect();
      if (ev.clientX >= areaRect.left && ev.clientX <= areaRect.right &&
          ev.clientY >= areaRect.top && ev.clientY <= areaRect.bottom) {
        createStickyNote(stickyColor, ev.clientX, ev.clientY);
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    e.preventDefault();
    e.stopPropagation();
  });

  // ========================================
  // Drawing — pencil & marker on canvas
  // ========================================
  let isDrawing = false;
  let currentPath = null;
  let currentSvg = null;
  let drawPoints = [];

  desktopArea.addEventListener('mousedown', (e) => {
    // Close all toolbar popups on canvas click
    closePencilSettings();
    stickyColorPicker.classList.remove('is-open');
    stickerPicker.classList.remove('is-open');

    if (activeTool !== 'pencil' && activeTool !== 'marker') return;
    if (e.target.closest('.figjam-toolbar') || e.target.closest('.sticker-picker') || e.target.closest('.window')) return;

    isDrawing = true;
    drawPoints = [];

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'canvas-drawing');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '6000px';
    svg.style.height = '4000px';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '45';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    if (activeTool === 'marker') {
      path.setAttribute('stroke', 'rgba(240, 160, 192, 0.5)');
      path.setAttribute('stroke-width', '8');
    } else {
      path.setAttribute('stroke', pencilColor);
      path.setAttribute('stroke-width', String(pencilSize));
    }
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    canvas.appendChild(svg);

    currentSvg = svg;
    currentPath = path;

    const pos = screenToCanvas(e.clientX, e.clientY);
    drawPoints.push(pos);
    currentPath.setAttribute('d', `M${pos.x},${pos.y}`);

    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDrawing || !currentPath) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    drawPoints.push(pos);

    let d = `M${drawPoints[0].x},${drawPoints[0].y}`;
    for (let i = 1; i < drawPoints.length; i++) {
      d += ` L${drawPoints[i].x},${drawPoints[i].y}`;
    }
    currentPath.setAttribute('d', d);
  });

  document.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentSvg && drawPoints.length > 1) {
      // SVG stays pointer-events:none, only the path is clickable
      const pathEl = currentSvg.querySelector('path');
      if (pathEl) pathEl.style.pointerEvents = 'stroke';
      const svgEl = currentSvg;
      pushUndo({ type: 'add', element: svgEl });
      svgEl.addEventListener('mousedown', (e) => {
        if (activeTool !== 'cursor') return;
        selectElement(svgEl);
        e.stopPropagation();
      });
    } else if (currentSvg) {
      currentSvg.remove();
    }

    currentPath = null;
    currentSvg = null;
    drawPoints = [];
  });

  // ========================================
  // Sticky Notes — create on canvas
  // ========================================
  function createStickyNote(color, clientX, clientY) {
    const note = document.createElement('div');
    note.className = 'sticky-note is-landing';
    note.style.background = color;

    note.innerHTML = `
      <div class="sticky-note__drag-handle">
        <div class="sticky-note__dots">
          <div class="sticky-note__dot"></div>
          <div class="sticky-note__dot"></div>
          <div class="sticky-note__dot"></div>
          <div class="sticky-note__dot"></div>
          <div class="sticky-note__dot"></div>
          <div class="sticky-note__dot"></div>
        </div>
        <button class="sticky-note__delete">&times;</button>
      </div>
      <div class="sticky-note__text" contenteditable="true"></div>
    `;

    const pos = screenToCanvas(clientX - 100, clientY - 100);
    note.style.left = pos.x + 'px';
    note.style.top = pos.y + 'px';

    canvas.appendChild(note);
    pushUndo({ type: 'add', element: note });
    setTimeout(() => note.classList.remove('is-landing'), 300);

    const textEl = note.querySelector('.sticky-note__text');
    setTimeout(() => textEl.focus(), 320);

    textEl.addEventListener('focus', () => note.classList.add('is-editing'));
    textEl.addEventListener('blur', () => note.classList.remove('is-editing'));

    note.addEventListener('mousedown', (e) => {
      selectElement(note);
      e.stopPropagation();
    });

    const handle = note.querySelector('.sticky-note__drag-handle');
    let isDragging = false;
    let startX, startY, origX, origY;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sticky-note__delete')) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      origX = parseInt(note.style.left) || 0;
      origY = parseInt(note.style.top) || 0;
      note.style.zIndex = 70;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      note.style.left = origX + (e.clientX - startX) + 'px';
      note.style.top = origY + (e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        note.style.zIndex = 50;
        const newX = parseInt(note.style.left) || 0;
        const newY = parseInt(note.style.top) || 0;
        if (newX !== origX || newY !== origY) {
          pushUndo({ type: 'move', element: note, oldX: origX, oldY: origY });
        }
      }
    });

    note.querySelector('.sticky-note__delete').addEventListener('click', () => {
      if (selectedElement === note) selectedElement = null;
      const parent = note.parentNode;
      pushUndo({ type: 'delete', element: note, parent: parent });
      note.style.transition = 'transform 0.2s, opacity 0.2s';
      note.style.transform = 'scale(0)';
      note.style.opacity = '0';
      setTimeout(() => note.remove(), 200);
    });

    note.addEventListener('mousedown', (e) => e.stopPropagation());
  }
});
