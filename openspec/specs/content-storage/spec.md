# content-storage Specification

## Purpose
TBD - created by archiving change images. Update Purpose after archive.
## Requirements

### Requirement: Content repository
Binary content (images) SHALL be stored through a content repository that stores bytes of a known type, returns a stored item by its ID, deletes an item, and gives the URL browsers load an item from. The application SHALL use only this interface; which implementation stores the bytes (the file system now, a CDN or object store later) SHALL be chosen in one place. The file-system implementation SHALL keep items under a configurable folder (by default `data/content`, inside the data folder), write each item completely or not at all, and serve items from the app's own `/content/:id` path; an in-memory implementation SHALL exist for tests.

#### Scenario: Swapping where content lives
- **WHEN** the content repository is replaced by another implementation in the composition module
- **THEN** uploading, serving URLs and image blocks work without changes elsewhere

#### Scenario: Stored on disk
- **WHEN** an image is stored with the file-system implementation
- **THEN** its bytes are in a file under the content folder, and nothing is written to the database

### Requirement: Content is addressed by its bytes
A stored item's ID SHALL be derived from its bytes and type (a SHA-256 hash plus the type's extension), so storing the same bytes again SHALL return the same ID without storing a second copy, and an item SHALL never change. IDs SHALL be checked against that form wherever they're read, and anything else SHALL be treated as unknown.

#### Scenario: The same image twice
- **WHEN** the same screenshot is uploaded twice
- **THEN** both uploads answer the same ID and one copy is stored

#### Scenario: A malformed ID
- **WHEN** `/content/../app.sqlite` is requested
- **THEN** the answer is 404 and no file outside the content folder is read

### Requirement: Uploading images
`POST /api/content` SHALL accept one file as the request body and store it when its bytes are a PNG, JPEG, GIF or WebP image of at most 10 MB, answering `201` with its `id`, `url`, `type` and `size`. The type SHALL be determined from the bytes, not from what the request declares. Other types (SVG included) SHALL be refused with `415`, and larger files with `413`, each with a message saying why; nothing SHALL be stored for a refused file.

#### Scenario: Upload a screenshot
- **WHEN** a 300 KB PNG is posted
- **THEN** the answer is `201` with an ID ending in `.png` and a URL that serves it

#### Scenario: An SVG
- **WHEN** an SVG file is posted, declared as `image/png`
- **THEN** the answer is `415` saying only PNG, JPEG, GIF and WebP images are accepted

#### Scenario: Too big
- **WHEN** a 12 MB JPEG is posted
- **THEN** the answer is `413` saying images can be at most 10 MB

### Requirement: Serving content
`GET /content/:id` SHALL answer a stored item's bytes with its type, `X-Content-Type-Options: nosniff`, and a cache header marking it immutable for a year; an unknown or malformed ID SHALL answer `404`.

#### Scenario: Served with its type
- **WHEN** an uploaded JPEG's URL is loaded
- **THEN** the answer has `Content-Type: image/jpeg`, `nosniff` and `Cache-Control: public, max-age=31536000, immutable`
