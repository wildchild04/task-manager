## ADDED Requirements

### Requirement: Images
An image block SHALL render as its image with its alt text, loaded lazily, scaled to fit the page's width without distortion: an uploaded image from its stored item's URL, an external one from its URL. An image that can't be loaded SHALL show the image component's error state with the alt text instead of a broken picture.

#### Scenario: An uploaded image
- **WHEN** a page with an image block holding an uploaded PNG is opened
- **THEN** the image is shown from its `/content/` URL with its alt text

#### Scenario: A broken external image
- **WHEN** an image block's external URL answers 404
- **THEN** the error state shows in its place, with the alt text
