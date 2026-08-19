# Cloudinary

Cloudinary is the file storage and image delivery service used for user and auction media.

## Environment Variables

```ini
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Flow

1. The API receives a file upload request.
2. The server validates and processes the incoming file.
3. The file is uploaded to Cloudinary.
4. Cloudinary returns a public asset URL and public ID.
5. The application stores the returned metadata in the database.

## Code Snippet

```ts
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});
```

## Typical Uses

* profile photos
* cover images
* auction image galleries
* blog media

## Operational Notes

* Keep `imagePublicId` if you need to replace or delete assets later.
* Store URLs and public IDs together so cleanup remains deterministic.
