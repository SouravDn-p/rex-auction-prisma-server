import { CloudinaryService } from '../../../services/cloudinary/cloudinary.service.ts';

export async function uploadImages(
  files: Express.Multer.File[] | undefined,
  folder: string
): Promise<string[]> {
  if (!files?.length) return [];

  const results = await Promise.all(
    files.map((file) => CloudinaryService.uploadImage(file.buffer, folder))
  );

  return results.map((result) => result.secure_url);
}

export async function uploadSingleImage(
  file: Express.Multer.File | undefined,
  folder: string
): Promise<string | null> {
  if (!file) return null;

  const result = await CloudinaryService.uploadImage(file.buffer, folder);
  return result.secure_url;
}
