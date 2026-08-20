# Cloudinary

Cloudinary is the file storage and image delivery service for every uploaded image in the app: user photos/covers, auction galleries, blog images, and announcement banners.

## Environment Variables

```ini
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

> [!WARNING]
> These three variables are read directly via `process.env` in [`src/config/cloudinary/cloudinary.ts`](../../src/config/cloudinary/cloudinary.ts), **not** through [`env.config.ts`](../../src/config/env.config.ts) like the rest of the app's configuration. They are not validated at startup — a missing key won't throw until the first upload attempt. See the [Known Gaps](../../README.md#-known-gaps--notes-for-contributors) section in the root README.

## Configuration

```ts
// src/config/cloudinary/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});
```

## Upload pipeline

Files never touch disk — they flow straight from the client through `multer`'s in-memory storage to Cloudinary:

```
multipart/form-data request
  → multer (memory storage, src/app/common/middlewares/upload.ts)
    → req.file / req.files as in-memory Buffers
      → src/app/common/utils/upload.util.ts
        → src/services/cloudinary (CloudinaryService.uploadImage)
          → Cloudinary API
            → { secure_url, public_id }
```

[`upload.util.ts`](../../src/app/common/utils/upload.util.ts) exposes two thin wrappers used by controllers:

```ts
uploadSingleImage(file: Express.Multer.File, folder: string): Promise<string | null>
uploadImages(files: Express.Multer.File[], folder: string): Promise<string[]>
```

Both call `CloudinaryService.uploadImage(file.buffer, folder)` and return the resulting `secure_url`(s).

### Where it's used

Only two modules actually run multer/Cloudinary uploads server-side:

| Module | Multer config | Notes |
| --- | --- | --- |
| Blog | `upload.array('images', 5)` | Up to 5 images per post |
| Announcements | `upload.single('image')` | One banner image per announcement |

Users and Auctions do **not** upload through this backend — `User.photo`/`User.cover` and `Auction.images` are plain URL strings validated with `Joi.string().uri()` in their DTOs (`src/app/modules/users/dto/users.dto.ts`, `src/app/modules/auctions/dto/*.ts`). Whatever client calls those endpoints is expected to have already obtained a hosted URL (e.g. via a separate/unsigned Cloudinary upload flow on the frontend) before submitting the profile update or auction creation request.

## Typical uses

* profile photos and cover images
* blog post images (up to 5 per post)
* announcement banners

## Operational notes

* Keep `imagePublicId` (on `User`) alongside the URL if the asset needs to be replaced or deleted later — Cloudinary deletions require the `public_id`, not the URL.
* Store URLs and public IDs together wherever both exist so cleanup stays deterministic; a URL alone isn't enough to delete or transform an asset later.
* Because uploads happen in-memory (multer memory storage), request body size limits (`express.json({ limit: '10kb' })` doesn't apply to multipart bodies, but be mindful of large file uploads consuming process memory under load — there's no explicit file-size limit configured on the multer instance today).
