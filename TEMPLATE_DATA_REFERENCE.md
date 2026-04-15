# CardCraft Template Data - Complete Reference

## 1. DATABASE LOCATION & STATUS
- **SQLite File**: `./cardcraft.db` (root directory)
- **Size**: ~1-2 MB
- **Status**: Contains 20 published templates with full canvas data
- **Last Modified**: 2026-04-15

## 2. TEMPLATE SCHEMA (Database Structure)

### Templates Table Fields
```sql
CREATE TABLE templates (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL,
  category        TEXT DEFAULT 'birthday',
  status          TEXT DEFAULT 'draft',  -- 'draft' or 'published'
  preview_image   TEXT,                  -- URL or null
  canvas_json     TEXT NOT NULL,         -- Full design JSON (1500-2700 bytes each)
  thumbnail_color TEXT DEFAULT '#8B5CF6',
  is_pro          BOOLEAN DEFAULT FALSE,
  usage_count     INTEGER DEFAULT 0,
  created_at      TEXT                   -- ISO timestamp
)
```

### TypeScript Types (server/schema.ts)
```typescript
export type Template = {
  id: number;
  title: string;
  category: string;
  status: "draft" | "published";
  previewImage: string | null;
  canvasJson: string;  // JSON string
  thumbnailColor: string;
  isPro: boolean;
  usageCount: number;
  createdAt: Date;
};

export type InsertTemplate = Omit<Template, 'id' | 'createdAt'>;
```

## 3. COMPLETE TEMPLATE LIST (20 Total)

### By Category:
- **Birthday (5)**: Royal Elegance, Vibrant Celebration, Modern Minimal, Warm Celebration, Floral Birthday
- **Celebration (7)**: Baby Dedication, Naming Ceremony, Valentine's Day, Mother's Day, Father's Day, Happy New Year, Merry Christmas
- **Achievement (2)**: Sports Achievement, Congratulations / Promotion
- **Corporate (2)**: Corporate Milestone, Retirement
- **Graduation (1)**: Golden Graduation
- **Church (1)**: Church Anniversary
- **Anniversary (1)**: Wedding Anniversary
- **Eid (1)**: Eid Mubarak

**All templates**: Status = "published", is_pro = 0 (free)

## 4. CANVAS_JSON STRUCTURE

### Root Structure
```typescript
{
  background: string;        // Color code, e.g. "#1a0533"
  objects: FabricObject[];   // Array of design elements
}
```

### Fabric.js Object Types Used
```typescript
type FabricObject = {
  type: 'rect' | 'circle' | 'text' | 'image' | 'path';
  left: number;        // X position
  top: number;         // Y position
  width?: number;
  height?: number;
  radius?: number;
  fill: string;        // Color or gradient
  stroke?: string;
  strokeWidth?: number;
  
  // Text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: 'italic' | 'normal';
  fontWeight?: string | number;
  textAlign?: 'left' | 'center' | 'right';
  
  // State properties
  customType?: 'background' | 'photo_frame' | 'greeting' | 'name' | 'date' | 'subtitle' | 'custom';
  editable?: boolean;
  movable?: boolean;
  resizable?: boolean;
  styleEditable?: boolean;
  selectable?: boolean;
  locked?: boolean;
  evented?: boolean;
  originX?: 'left' | 'center' | 'right';
  rx?: number;         // Border radius
  ry?: number;
};
```

### Sample Objects (from Template ID 1 - "Royal Elegance")

**Background Rectangle:**
```json
{
  "type": "rect",
  "left": 0,
  "top": 0,
  "width": 800,
  "height": 1000,
  "fill": "#1a0533",
  "customType": "background",
  "selectable": false,
  "locked": true,
  "evented": false
}
```

**Greeting Text:**
```json
{
  "type": "text",
  "text": "Happy Birthday",
  "left": 400,
  "top": 430,
  "fontSize": 42,
  "fontFamily": "Georgia",
  "fill": "#FFD700",
  "textAlign": "center",
  "originX": "center",
  "customType": "greeting",
  "editable": true,
  "movable": true,
  "styleEditable": true
}
```

**Photo Frame (Circle):**
```json
{
  "type": "circle",
  "left": 200,
  "top": 200,
  "radius": 180,
  "fill": "rgba(255,255,255,0.06)",
  "stroke": "rgba(255,215,0,0.5)",
  "strokeWidth": 3,
  "customType": "photo_frame",
  "editable": true,
  "movable": true,
  "resizable": true,
  "selectable": true
}
```

## 5. EXAMPLE FULL TEMPLATE (Template ID 1 - "Royal Elegance")

### Metadata:
```json
{
  "id": 1,
  "title": "Royal Elegance",
  "category": "birthday",
  "status": "published",
  "preview_image": null,
  "thumbnail_color": "#2d0a5e",
  "is_pro": 0,
  "usage_count": 0,
  "created_at": "2026-04-15T10:53:17.400Z",
  "canvas_json_size": 1853
}
```

### Canvas Objects (9 total):
1. Background rect (#1a0533) - locked
2. Decorative circle - rgba(255,215,0,0.08)
3. Border rect - transparent with gold stroke
4. Photo frame circle - resizable
5. "Happy Birthday" text - editable
6. "JOHN DOE" name text - editable, bold
7. "April 15, 2026" date text - editable
8. "Celebrating a Life Well Lived" subtitle - italic
9. Decorative line - horizontal divider

### Canvas Dimensions:
- Width: 800px
- Height: 1000px
- Aspect ratio: 4:5 (portrait)

## 6. TEMPLATE DATA SAMPLE FILES

Generated files for reference:
- `template-export-1.json` - Full template with canvas_json
- `all-templates-metadata.json` - All 20 templates without canvas_json
- `template-objects-sample.json` - Sample objects structure
- `analyze-canvas.js` - Script to analyze canvas structure

## 7. API ENDPOINTS FOR TEMPLATES

### Retrieve Templates
```
GET /api/templates              - Returns all published templates
GET /api/templates/:id          - Returns single template by ID
```

### Admin Operations (requires auth + admin role)
```
POST   /api/templates           - Create new template
PATCH  /api/templates/:id       - Update template
DELETE /api/templates/:id       - Delete template
```

### Request/Response Format
```typescript
// Create/Update
POST /api/templates
Content-Type: application/json
{
  title: string;
  category: string;
  status: "draft" | "published";
  canvasJson: string;  // Stringified JSON
  thumbnailColor: string;
  isPro?: boolean;
  previewImage?: string;
}

// Response
{
  id: number;
  title: string;
  category: string;
  status: string;
  canvasJson: string;
  thumbnailColor: string;
  isPro: boolean;
  usageCount: number;
  createdAt: string;
}
```

## 8. SEEDING CURRENT STATE

### Current Seeding:
- **Admin Seed Only**: `/api/admin/seed` only creates `admin@cardcraft.com` (non-production only)
- **No Template Seed Endpoint**: Templates are not automatically seeded; they're loaded from the SQLite database
- **20 Pre-created Templates**: All 20 templates exist in the SQLite database and are loaded on startup

### Previous SQLite Era:
- Original templates were created/exported via the admin panel UI
- Templates stored in `./cardcraft.db` using better-sqlite3
- Schema created on first run with `initDb()` function in `server/storage.ts`

## 9. MIGRATION PATH (SQLite → PostgreSQL)

### Status:
- **Current Setup**: PostgreSQL via Supabase (see `server/db.ts` and `server/storage.ts`)
- **Old SQLite File**: Still exists at `./cardcraft.db` - can be used as data source

### To Restore Templates to PostgreSQL:
1. Query templates from `./cardcraft.db`
2. Insert into PostgreSQL `templates` table via `storage.createTemplate()`
3. Run endpoint: `GET /api/templates` to verify

## 10. DESIGN SPECIFICATIONS

### Canvas Dimensions:
- Standard: 800x1000px (4:5 ratio, portrait)
- Resolution: 96 DPI
- Orientation: Portrait (greeting card format)

### Common Colors:
- Backgrounds: Dark navy, purple, burgundy, teal, white
- Accents: Gold (#FFD700), white, rgba colors
- Text: Primary = white or gold, Secondary = light rgba

### Common Fonts:
- Georgia (serif, elegant)
- Modern sans-serif (unnamed, likely system default)
- Font sizes: 20-58px range

### Object Types:
- Background layer (non-editable)
- Decorative shapes (circles, rects, lines)
- Photo frames (circular, editable, resizable)
- Editable text fields (greeting, name, date, caption)

## 11. IMPORTANT NOTES

### Canvas Data Size:
- Average: 1800-2500 bytes per template
- Stored as JSON string in `canvas_json` column
- Can be parsed with `JSON.parse()` in client/server

### Editability:
- Templates marked with `editable: true` can be modified by users
- `customType` field identifies semantic purpose (greeting, name, date, etc.)
- `styleEditable: true` allows font/color/position changes

### Current Database:
- **Using**: PostgreSQL (Supabase)
- **Backup**: SQLite file `./cardcraft.db` still available
- **Sync Status**: PostgreSQL tables created but no templates migrated yet
