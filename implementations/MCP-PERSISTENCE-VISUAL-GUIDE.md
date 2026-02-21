# MCP Persistence - Visual Guide

## 🎨 UI Components

### 1. Connected Servers Section
```
┌─────────────────────────────────────────────────────────┐
│ Connected Servers                                  [2]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 🟢 pms-server                    8 tools    [X] │    │
│ │ /Users/dev/servers/pms-server.py                │    │
│ │ [create_patient] [get_patient] [list_patients] │    │
│ │ +5 more                                         │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 🟢 lts-server                    9 tools    [X] │    │
│ │ /Users/dev/servers/lts-server.py                │    │
│ │ [order_lab_test] [get_lab_results] [create...] │    │
│ │ +6 more                                         │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- 🟢 Green pulsing status indicator
- Tool count badge
- Tool preview (first 3 tools)
- Disconnect button (X)
- Sage green gradient background

---

### 2. Saved Servers Section (Disconnected)
```
┌─────────────────────────────────────────────────────────┐
│ Saved Servers                                      [3]  │
│ Previously connected servers - click retry to reconnect │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ⚪ staff-server                                  │    │
│ │ /Users/dev/servers/staff-server.py              │    │
│ │ Connected 5 times • Last: Jan 19, 2026          │    │
│ │                          [🔄 Retry] [🗑️]        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ⚪ appointment-server                            │    │
│ │ /Users/dev/servers/appointment-server.py        │    │
│ │ Connected 12 times • Last: Jan 18, 2026         │    │
│ │                          [🔄 Retry] [🗑️]        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- ⚪ Gray status indicator (not connected)
- Connection metadata (count + last date)
- Sage green "Retry" button
- Red trash icon for removal
- Subtle sage/slate gradient background

---

### 3. Saved Servers Section (Already Connected)
```
┌─────────────────────────────────────────────────────────┐
│ Saved Servers                                      [2]  │
│ Previously connected servers - click retry to reconnect │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 🟢 pms-server              [CONNECTED]          │    │
│ │ /Users/dev/servers/pms-server.py                │    │
│ │ Connected 15 times • Last: Jan 19, 2026         │    │
│ │                                      [🗑️]       │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ⚪ lts-server                                    │    │
│ │ /Users/dev/servers/lts-server.py                │    │
│ │ Connected 8 times • Last: Jan 18, 2026          │    │
│ │                          [🔄 Retry] [🗑️]        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- 🟢 Green status for connected servers
- "CONNECTED" badge (sage green)
- No retry button (already connected)
- Slightly dimmed appearance
- Can still be removed from saved list

---

### 4. Retry Button States

#### Normal State
```
┌──────────────┐
│ 🔄 Retry     │  ← Sage green gradient
└──────────────┘
```

#### Hover State
```
┌──────────────┐
│ 🔄 Retry     │  ← Darker sage green + shadow
└──────────────┘
```

#### Loading State
```
┌──────────────────┐
│ ⚪ Connecting... │  ← Spinner animation
└──────────────────┘
```

---

## 🎨 Color Palette

### Saved Server Items
```css
/* Background */
background: linear-gradient(135deg, 
  rgba(42, 61, 51, 0.05) 0%,    /* Sage 900 at 5% */
  rgba(42, 59, 76, 0.05) 100%   /* Slate Blue 900 at 5% */
);

/* Border */
border: 1px solid rgba(93, 133, 112, 0.2);  /* Sage 500 at 20% */

/* Hover */
background: linear-gradient(135deg, 
  rgba(42, 61, 51, 0.08) 0%, 
  rgba(42, 59, 76, 0.08) 100%
);
border-color: rgba(93, 133, 112, 0.3);
```

### Connected Server Items
```css
/* Background */
background: linear-gradient(135deg, 
  rgba(93, 133, 112, 0.1) 0%,   /* Sage 500 at 10% */
  rgba(100, 125, 148, 0.1) 100% /* Slate Blue 500 at 10% */
);

/* Border */
border: 1px solid rgba(93, 133, 112, 0.3);

/* Hover */
background: linear-gradient(135deg, 
  rgba(93, 133, 112, 0.15) 0%, 
  rgba(100, 125, 148, 0.15) 100%
);
border-color: rgba(93, 133, 112, 0.4);
```

### Retry Button
```css
/* Normal */
background: linear-gradient(135deg, 
  #5D8570 0%,   /* Sage 500 */
  #3D5C4C 100%  /* Sage 700 */
);

/* Hover */
background: linear-gradient(135deg, 
  #3D5C4C 0%,   /* Sage 700 */
  #2A3D33 100%  /* Sage 900 */
);
box-shadow: 0 4px 12px rgba(93, 133, 112, 0.3);
```

### Connected Badge
```css
background: rgba(93, 133, 112, 0.2);  /* Sage 500 at 20% */
color: #2A3D33;                        /* Sage 900 */
```

### Status Indicators
```css
/* Connected (green pulsing) */
.tool-modal__server-status--connected {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
  animation: pulse 2s ease-in-out infinite;
}

/* Saved (gray static) */
.tool-modal__server-status--saved {
  background: #6b7280;
  animation: none;
}
```

---

## 📱 Responsive Behavior

### Desktop (>640px)
```
┌─────────────────────────────────────────────────┐
│ ⚪ staff-server                                  │
│ /Users/dev/servers/staff-server.py              │
│ Connected 5 times • Last: Jan 19, 2026          │
│                          [🔄 Retry] [🗑️]        │
└─────────────────────────────────────────────────┘
```
- Horizontal layout
- Buttons on the right
- Full metadata visible

### Mobile (≤640px)
```
┌─────────────────────────────────────────────────┐
│ ⚪ staff-server                                  │
│ /Users/dev/servers/staff-server.py              │
│ Connected 5 times • Last: Jan 19, 2026          │
│                                                 │
│ [        🔄 Retry        ] [🗑️]                │
└─────────────────────────────────────────────────┘
```
- Vertical layout
- Buttons below info
- Retry button expands full width
- Reduced padding

---

## 🎬 Animations

### Status Pulse (Connected)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```
- 2 second cycle
- Smooth ease-in-out
- Infinite loop

### Button Hover
```css
transform: translateY(-1px);
box-shadow: 0 4px 12px rgba(93, 133, 112, 0.3);
```
- Lifts up 1px
- Adds shadow
- 0.15s transition

### Spinner (Loading)
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```
- 0.8s linear
- Infinite rotation
- White border with transparent top

---

## 🔄 State Transitions

### Server Connection Flow
```
1. Saved (Disconnected)
   ⚪ Gray dot
   [Retry] button visible
   ↓ User clicks Retry
   
2. Connecting
   ⚪ Spinner animation
   "Connecting..." text
   Button disabled
   ↓ Connection succeeds
   
3. Connected
   🟢 Green pulsing dot
   [CONNECTED] badge
   No retry button
   Appears in "Connected Servers"
   Still in "Saved Servers" (dimmed)
```

### Server Removal Flow
```
1. Server in saved list
   ↓ User clicks trash icon
   
2. Removed from localStorage
   ↓ UI updates
   
3. Server disappears from list
   Count badge decrements
```

---

## 💡 Visual Hierarchy

### Priority Levels
1. **Connected Servers** (Highest)
   - Bright green status
   - Full tool preview
   - Top of modal

2. **Saved Servers - Disconnected** (Medium)
   - Gray status
   - Retry button prominent
   - Below connected servers

3. **Saved Servers - Already Connected** (Lowest)
   - Dimmed appearance
   - No retry button
   - Bottom of saved list

### Color Intensity
- **Most Important**: Full opacity, bright colors
- **Active**: Medium opacity, sage green
- **Inactive**: Low opacity, gray tones

---

## 🎯 User Experience

### Visual Feedback
1. **Hover Effects**: Subtle background change + border color
2. **Loading States**: Spinner animation + disabled state
3. **Success States**: Green indicator + badge
4. **Error States**: Red error message below input

### Information Density
- **Essential**: Server name, path, status
- **Helpful**: Tool count, connection history
- **Optional**: Tool preview (connected only)

### Action Clarity
- **Primary Action**: Retry (sage green, prominent)
- **Secondary Action**: Remove (gray, subtle)
- **Destructive Action**: Disconnect (red on hover)

---

All visual elements follow the GoatedApp brand guidelines with Sage Green and Slate Blue color palette! 🎨
