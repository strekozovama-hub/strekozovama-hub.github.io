// ========================================
// macOS Desktop Portfolio — Interactions
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // -- Menu bar clock --
  const timeEl = document.getElementById('menubar-time');
  function updateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Lisbon',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    timeEl.textContent = `Portugal, Porto time ${time}`;
  }
  updateTime();
  setInterval(updateTime, 30000);

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
  const menubarTime = document.getElementById('menubar-time');
  let isPanning = false;
  let panStartX, panStartY;
  let zoom = 0.7;
  let canvasX = window.innerWidth / 2 - 3000 * zoom;
  let canvasY = desktopArea.clientHeight / 2 - 2000 * zoom;
  canvas.style.transform = `translate(${canvasX}px, ${canvasY}px) scale(${zoom})`;
  canvas.style.transformOrigin = '0 0';

  // -- Position desktop folders relative to viewport --
  function positionFolders() {
    const allFolders = document.querySelectorAll('.desktop-folder[data-col], .tools-widget[data-col]');
    const bottomRightIds = ['folder-artist', 'dock-trash'];
    const folders = Array.from(allFolders).filter(f => !bottomRightIds.includes(f.id));
    if (!folders.length) return;
    const rowGap = 120;
    const folderWidth = 120;
    const cardTopCanvas = (41 - canvasY) / zoom;
    // Flush with menubar bottom (desktop__area starts at y=25 in viewport)
    const folderTopCanvas = (4 - canvasY) / zoom;
    // Right-align to the right edge of the menubar time element
    const colRight = (window.innerWidth - 12 - canvasX) / zoom;
    folders.forEach(f => {
      const row = +f.dataset.row;
      f.style.left = (colRight - folderWidth) + 'px';
      f.style.top = (folderTopCanvas + row * rowGap) + 'px';
    });

    // Below sidebar: I'm an artist + Other (trash)
    const aboutCard = document.getElementById('about-card');
    const aboutBottom = aboutCard ? aboutCard.getBoundingClientRect().bottom : 29;
    const sidebarLeft = 12; // sidebar left: 12px viewport
    const belowSidebarY = (aboutBottom + 16 - 25 - canvasY) / zoom;
    const sidebarLeftCanvas = (sidebarLeft - canvasX) / zoom;
    const artist = document.getElementById('folder-artist');
    if (artist && !artist.dataset.userMoved) {
      artist.style.left = sidebarLeftCanvas + 'px';
      artist.style.top = belowSidebarY + 'px';
    }
    const trash = document.getElementById('dock-trash');
    if (trash && !trash.dataset.userMoved) {
      trash.style.left = (sidebarLeftCanvas + folderWidth + 20) + 'px';
      trash.style.top = belowSidebarY + 'px';
    }

    const card = document.getElementById('card-chart-reviewer');
    if (card && !card.dataset.userMoved) {
      card.style.left = (window.innerWidth / 2 - 40 - canvasX) / zoom - 276 + 'px';
      card.style.top = (cardTopCanvas - 32) + 'px';
    }

    const card2 = document.getElementById('card-chart-generation');
    if (card && card2 && !card2.dataset.userMoved) {
      card2.style.left = (parseFloat(card.style.left) + 166) + 'px';
      card2.style.top = (parseFloat(card.style.top) + 8) + 'px';
    }

    const card3 = document.getElementById('card-tbank');
    if (card && card3 && !card3.dataset.userMoved) {
      card3.style.left = parseFloat(card.style.left) + 'px';
      card3.style.top = (parseFloat(card.style.top) + 550) + 'px';
    }
  }

  positionFolders();
  window.addEventListener('resize', positionFolders);

  desktopArea.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window')) return;

    if (!e.target.closest('.desktop-folder') && !e.target.closest('.desktop-item')) {
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
      desktopArea.style.cursor = 'default';
    }
  });

  // -- Zoom (Ctrl/Cmd+scroll or pinch) --
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

  // -- Project Card drag + click --
  const projectCard = document.getElementById('card-chart-reviewer');
  if (projectCard) {
    let cardDragging = false;
    let cardMoved = false;
    let cardStartX, cardStartY, cardOrigX, cardOrigY;

    projectCard.addEventListener('mousedown', (e) => {
      cardDragging = true;
      cardMoved = false;
      cardStartX = e.clientX; cardStartY = e.clientY;
      cardOrigX = parseInt(projectCard.style.left) || 0;
      cardOrigY = parseInt(projectCard.style.top) || 0;
      projectCard.style.zIndex = 60;
      selectElement(projectCard);
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!cardDragging) return;
      const dx = Math.abs(e.clientX - cardStartX);
      const dy = Math.abs(e.clientY - cardStartY);
      if (dx > 3 || dy > 3) cardMoved = true;
      projectCard.style.left = cardOrigX + (e.clientX - cardStartX) / zoom + 'px';
      projectCard.style.top = cardOrigY + (e.clientY - cardStartY) / zoom + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (cardDragging) {
        cardDragging = false;
        projectCard.style.zIndex = 50;
        const newX = parseInt(projectCard.style.left) || 0;
        const newY = parseInt(projectCard.style.top) || 0;
        if (newX !== cardOrigX || newY !== cardOrigY) {
          pushUndo({ type: 'move', element: projectCard, oldX: cardOrigX, oldY: cardOrigY });
          projectCard.dataset.userMoved = '1';
        }
      }
    });

    projectCard.addEventListener('click', () => {
      if (cardMoved) return;
      window.location.href = 'Cases/medvidi.html';
    });
  }

  // -- Project Card 3 drag + click (TBank) --
  const projectCard3 = document.getElementById('card-tbank');
  if (projectCard3) {
    let card3Dragging = false, card3Moved = false;
    let card3StartX, card3StartY, card3OrigX, card3OrigY;

    projectCard3.addEventListener('mousedown', (e) => {
      card3Dragging = true;
      card3Moved = false;
      card3StartX = e.clientX; card3StartY = e.clientY;
      card3OrigX = parseInt(projectCard3.style.left) || 0;
      card3OrigY = parseInt(projectCard3.style.top) || 0;
      projectCard3.style.zIndex = 55;
      selectElement(projectCard3);
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!card3Dragging) return;
      const dx = Math.abs(e.clientX - card3StartX);
      const dy = Math.abs(e.clientY - card3StartY);
      if (dx > 3 || dy > 3) card3Moved = true;
      projectCard3.style.left = card3OrigX + (e.clientX - card3StartX) / zoom + 'px';
      projectCard3.style.top = card3OrigY + (e.clientY - card3StartY) / zoom + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (card3Dragging) {
        card3Dragging = false;
        projectCard3.style.zIndex = 40;
        const newX = parseInt(projectCard3.style.left) || 0;
        const newY = parseInt(projectCard3.style.top) || 0;
        if (newX !== card3OrigX || newY !== card3OrigY) {
          pushUndo({ type: 'move', element: projectCard3, oldX: card3OrigX, oldY: card3OrigY });
          projectCard3.dataset.userMoved = '1';
        }
      }
    });

    projectCard3.addEventListener('click', () => {
      if (card3Moved) return;
      window.open('https://marinastrekozova.notion.site/Arrestments-case-13b439eac0cc80ce8f4cc3816e1e66d1?source=copy_link', '_blank');
    });
  }

  // -- Project Card 2 drag (Coming Soon) --
  const projectCard2 = document.getElementById('card-chart-generation');
  if (projectCard2) {
    let card2Dragging = false;
    let card2Moved = false;
    let card2StartX, card2StartY, card2OrigX, card2OrigY;

    projectCard2.addEventListener('mousedown', (e) => {
      card2Dragging = true;
      card2Moved = false;
      card2StartX = e.clientX; card2StartY = e.clientY;
      card2OrigX = parseInt(projectCard2.style.left) || 0;
      card2OrigY = parseInt(projectCard2.style.top) || 0;
      projectCard2.style.zIndex = 60;
      selectElement(projectCard2);
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!card2Dragging) return;
      const dx = Math.abs(e.clientX - card2StartX);
      const dy = Math.abs(e.clientY - card2StartY);
      if (dx > 3 || dy > 3) card2Moved = true;
      projectCard2.style.left = card2OrigX + (e.clientX - card2StartX) / zoom + 'px';
      projectCard2.style.top = card2OrigY + (e.clientY - card2StartY) / zoom + 'px';
    });

    document.addEventListener('mouseup', (e) => {
      if (card2Dragging) {
        card2Dragging = false;
        projectCard2.style.zIndex = 45;
        const newX = parseInt(projectCard2.style.left) || 0;
        const newY = parseInt(projectCard2.style.top) || 0;
        if (newX !== card2OrigX || newY !== card2OrigY) {
          pushUndo({ type: 'move', element: projectCard2, oldX: card2OrigX, oldY: card2OrigY });
          projectCard2.dataset.userMoved = '1';
        } else if (!card2Moved) {
          showComingSoonToast(e);
        }
      }
    });
  }

  function showComingSoonToast(e) {
    const existing = document.getElementById('coming-soon-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'coming-soon-toast';
    toast.textContent = 'Coming soon';
    toast.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY - 40}px;
      transform: translateX(-50%);
      background: #2c2c2c;
      color: #f5f5f5;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      padding: 8px 14px;
      border-radius: 8px;
      pointer-events: none;
      z-index: 9999;
      opacity: 1;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 1200);
    setTimeout(() => { toast.remove(); }, 1500);
  }

  // -- Spotify widget drag --
  const spotifyWidget = document.getElementById('spotify-widget');
  // -- Info Panel tab switching --
  document.querySelectorAll('.info-panel__tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPane = tab.dataset.tab;
      const pane = document.querySelector(`.info-panel__pane[data-pane="${targetPane}"]`);
      const isOpen = pane.classList.contains('is-active');
      document.querySelectorAll('.info-panel__tab').forEach(t => t.classList.remove('is-active'));
      document.querySelectorAll('.info-panel__pane').forEach(p => p.classList.remove('is-active'));
      if (!isOpen) {
        tab.classList.add('is-active');
        pane.classList.add('is-active');
      }
    });
  });

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

});
